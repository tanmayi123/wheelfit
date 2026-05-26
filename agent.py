import asyncio
import httpx
import json
import os
from dotenv import load_dotenv
import anthropic

load_dotenv()

anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SEARCH_URL = "http://127.0.0.1:8002/tools/wayfair-search"
SCORE_URL  = "http://127.0.0.1:8001/tools/score-product"

async def search_products(category: str, max_width: float, style: str):
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(SEARCH_URL, json={
            "category": category,
            "max_width_inches": max_width,
            "max_height_inches": 999,
            "style": style
        })
        return response.json()["products"]

async def score_product(product: dict, room_width: float, room_length: float, style: str, category: str):
    async with httpx.AsyncClient(timeout=30) as client:
        product_with_category = {**product, "category": category}
        response = await client.post(SCORE_URL, json={
            "product": product_with_category,
            "room_width_ft": room_width,
            "room_length_ft": room_length,
            "user_style": style
        })
        result = response.json()
        result["product"] = product
        return result

async def run_agent(
    room_width_ft: float,
    room_length_ft: float,
    furniture_needed: list[str],
    wheelchair_type: str,
    user_style: str
):
    print(f"\n🦽 Starting wheelchair furniture agent...")
    print(f"   Room: {room_width_ft}ft x {room_length_ft}ft")
    print(f"   Needs: {', '.join(furniture_needed)}")
    print(f"   Style: {user_style}\n")

    # PHASE 1 — calculate max dimensions per item
    room_width_inches = room_width_ft * 12
    clearance = 36  # minimum wheelchair clearance
    max_furniture_width = room_width_inches - clearance
    print(f"📐 Phase 1: Max furniture width = {max_furniture_width}\" (room {room_width_inches}\" - 36\" clearance)")

    # PHASE 2 — crawl + score each category
    all_scored = {}

    for category in furniture_needed:
        print(f"\n🔍 Phase 2: Searching for {category}...")
        products = await search_products(category, max_furniture_width, user_style)
        print(f"   Found {len(products)} products, scoring...")

        scored = []
        for product in products:
            score = await score_product(product, room_width_ft, room_length_ft, user_style, category)
            print(f"   DEBUG score response: {score}")
            scored.append(score)
            print(f"   ✓ {product['name']}: {score['total_score']}/100")

        # PHASE 3 — sort and keep top 5
        scored.sort(key=lambda x: x["total_score"], reverse=True)
        top5 = [s for s in scored[:5] if s["passes_clearance"]]
        all_scored[category] = top5
        print(f"   Top pick: {top5[0]['product']['name']} ({top5[0]['total_score']}/100)")

    # PHASE 4 — match into room combos using Claude
    print(f"\n🎨 Phase 4: Matching items into room combinations...")

    top_items_summary = {}
    for category, items in all_scored.items():
        top_items_summary[category] = [
            {
                "name": i["product"]["name"],
                "score": i["total_score"],
                "price": i["product"]["price"],
                "style_tags": i["product"]["style_tags"],
                "recommendation": i["recommendation"]
            }
            for i in items
        ]

    match_prompt = f"""
    You are a wheelchair-accessible interior design advisor.
    
    Room: {room_width_ft}ft x {room_length_ft}ft
    User style: {user_style}
    Wheelchair type: {wheelchair_type}
    
    Top scored items per category:
    {json.dumps(top_items_summary, indent=2)}
    
    Create 2 complete room setup combinations. Each combo should:
    - Pick one item per category that works well together stylistically
    - Ensure total floor footprint still allows a 60"x60" turning zone
    - Feel cohesive aesthetically
    
    Return ONLY valid JSON:
    {{
      "combos": [
        {{
          "name": "Combo A name",
          "items": {{"category": "product name"}},
          "total_price": 0,
          "style_description": "one sentence",
          "why_it_works": "one sentence about accessibility"
        }}
      ]
    }}
    """

    message = anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[{"role": "user", "content": match_prompt}]
    )

    raw = message.content[0].text
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
             raw = raw[4:]
    raw = raw.strip()


    combos = json.loads(raw)

    # Final output
    final_result = {
        "room": f"{room_width_ft}ft x {room_length_ft}ft",
        "style": user_style,
        "top_items_per_category": top_items_summary,
        "recommended_combos": combos["combos"]
    }

    print(f"\n✅ Done! Generated {len(combos['combos'])} room combinations")
    return final_result


if __name__ == "__main__":
    result = asyncio.run(run_agent(
        room_width_ft=12,
        room_length_ft=14,
        furniture_needed=["beds", "floor lamps"],
        wheelchair_type="standard",
        user_style="scandinavian minimalist"
    ))
    print("\n📦 FINAL RESULT:")
    print(json.dumps(result, indent=2))