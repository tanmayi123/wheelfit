from fastapi import FastAPI
from pydantic import BaseModel
#import baseten
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

SCORING_SYSTEM_PROMPT = """
You are a wheelchair accessibility furniture scoring expert.

Score the given furniture product out of 100 using EXACTLY this rubric:

1. CLEARANCE FIT (35 pts)
   - Will this item leave at least 36 inches of clearance on one side in the given room?
   - 35 = plenty of clearance, 20 = just barely passes, 0 = fails clearance

2. ACCESSIBILITY DESIGN (25 pts)
   - Open/panel base preferred (footrests don't catch)
   - Seat height 17-19 inches for chairs/sofas
   - Storage reachable from seated position (max 48 inches high)
   - No protruding handles or sharp corners
   - 25 = excellent accessibility design, 15 = acceptable, 0 = poor

3. FLOOR FOOTPRINT (20 pts)
   - Smaller footprint = more maneuvering room
   - Score relative to category (a smaller bed scores higher than a larger bed)
   - 20 = minimal footprint, 10 = moderate footprint, 0 = very large footprint

4. STYLE MATCH (15 pts)
   - How well does it match the user's stated aesthetic?
   - 15 = perfect match, 5 = decent match, 0 = completely different style

5. PRICE/VALUE (5 pts)
   - Relative to category average
   - 5 = great value, 3 = average, 0 = overpriced

Return ONLY valid JSON in this exact format, nothing else:
{
  "total_score": <number>,
  "breakdown": {
    "clearance_fit": <number>,
    "accessibility_design": <number>,
    "floor_footprint": <number>,
    "style_match": <number>,
    "price_value": <number>
  },
  "passes_clearance": <true or false>,
  "accessibility_notes": "<one sentence on key accessibility consideration>",
  "recommendation": "<one sentence on why this works or doesn't for a wheelchair user>"
}
"""

class Product(BaseModel):
    name: str
    width_inches: float
    height_inches: float
    depth_inches: float
    price: float
    base_type: str        # e.g. "4 legs", "panel base", "pedestal"
    category: str         # e.g. "bed", "lamp", "dresser"
    style_tags: list[str] # e.g. ["modern", "scandinavian"]

class ScoreRequest(BaseModel):
    product: Product
    room_width_ft: float
    room_length_ft: float
    user_style: str       # e.g. "scandinavian minimalist"


# using claude as of now for testing , will uncomment this when i get the baseten model working with baseten API key and model ID

#@app.post("/tools/score-product")
#async def score_product(request: ScoreRequest):
 #   prompt = f"""
  ## User style preference: {request.user_style}
    
    #Product to score:
    #- Name: {request.product.name}
    #- Category: {request.product.category}
    #- Dimensions: {request.product.width_inches}"W x {request.product.depth_inches}"D x {request.product.height_inches}"H
    #- Price: ${request.product.price}
    #- Base type: {request.product.base_type}
    #- Style tags: {", ".join(request.product.style_tags)}
    
    #Score this product using the rubric.
    #"""

    #model = baseten.deployed_model_id(os.getenv("BASETEN_MODEL_ID"))
    #result = model.predict({
     #   "messages": [
      ##     {"role": "user", "content": prompt}
        #]
    #})

   # import json
    #score_data = json.loads(result)
    #return score_data

import anthropic

anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

@app.post("/tools/score-product")
async def score_product(request: ScoreRequest):
    prompt = f"""
    Room: {request.room_width_ft}ft x {request.room_length_ft}ft
    User style preference: {request.user_style}
    
    Product to score:
    - Name: {request.product.name}
    - Category: {request.product.category}
    - Dimensions: {request.product.width_inches}"W x {request.product.depth_inches}"D x {request.product.height_inches}"H
    - Price: ${request.product.price}
    - Base type: {request.product.base_type}
    - Style tags: {", ".join(request.product.style_tags)}
    
    Score this product using the rubric.
    """

    message = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        system=SCORING_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}]
    )

    import json
    raw = message.content[0].text.strip()
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()
    score_data = json.loads(raw)

    return score_data