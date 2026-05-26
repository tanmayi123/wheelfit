from fastapi import FastAPI
from pydantic import BaseModel
import httpx
from bs4 import BeautifulSoup
import json

app = FastAPI()

class SearchRequest(BaseModel):
    category: str
    max_width_inches: float
    max_height_inches: float
    style: str

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def get_mock_products(category: str):
    mocks = {
        "beds": [
            {"name": "Nordic Platform Bed", "width_inches": 60, "height_inches": 14, "depth_inches": 80, "price": 499, "base_type": "panel base", "style_tags": ["scandinavian", "minimalist"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
            {"name": "Modern Low Profile Bed", "width_inches": 62, "height_inches": 12, "depth_inches": 82, "price": 399, "base_type": "panel base", "style_tags": ["modern", "minimalist"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
            {"name": "Classic 4-Post Bed", "width_inches": 64, "height_inches": 60, "depth_inches": 84, "price": 799, "base_type": "4 legs", "style_tags": ["traditional", "classic"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
            {"name": "Minimalist Wood Platform Bed", "width_inches": 58, "height_inches": 16, "depth_inches": 78, "price": 549, "base_type": "panel base", "style_tags": ["scandinavian", "minimalist", "wood"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
            {"name": "Low Profile Storage Bed", "width_inches": 61, "height_inches": 15, "depth_inches": 81, "price": 629, "base_type": "panel base", "style_tags": ["modern", "minimalist"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
        ],
        "floor lamps": [
            {"name": "Slim Arc Floor Lamp", "width_inches": 10, "height_inches": 72, "depth_inches": 10, "price": 89, "base_type": "weighted base", "style_tags": ["scandinavian", "minimalist"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
            {"name": "Tripod Floor Lamp", "width_inches": 18, "height_inches": 60, "depth_inches": 18, "price": 129, "base_type": "tripod", "style_tags": ["modern", "industrial"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
            {"name": "Nordic Cone Floor Lamp", "width_inches": 12, "height_inches": 65, "depth_inches": 12, "price": 109, "base_type": "weighted base", "style_tags": ["scandinavian", "minimalist"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
            {"name": "Adjustable Reading Floor Lamp", "width_inches": 11, "height_inches": 70, "depth_inches": 11, "price": 79, "base_type": "weighted base", "style_tags": ["modern", "minimalist"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
        ],
        "dressers": [
            {"name": "6-Drawer Scandinavian Dresser", "width_inches": 36, "height_inches": 44, "depth_inches": 18, "price": 349, "base_type": "panel base", "style_tags": ["scandinavian", "minimalist"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
            {"name": "Tall 8-Drawer Chest", "width_inches": 30, "height_inches": 58, "depth_inches": 16, "price": 299, "base_type": "4 legs", "style_tags": ["modern"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
            {"name": "Low Wide 4-Drawer Dresser", "width_inches": 48, "height_inches": 32, "depth_inches": 18, "price": 389, "base_type": "panel base", "style_tags": ["scandinavian", "minimalist"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
            {"name": "Compact 5-Drawer Dresser", "width_inches": 28, "height_inches": 46, "depth_inches": 16, "price": 279, "base_type": "panel base", "style_tags": ["modern", "minimalist"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
        ],
        "sofas": [
            {"name": "Low Profile Scandinavian Sofa", "width_inches": 84, "height_inches": 17, "depth_inches": 34, "price": 899, "base_type": "panel base", "style_tags": ["scandinavian", "minimalist"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
            {"name": "Modern 3-Seater Sofa", "width_inches": 78, "height_inches": 18, "depth_inches": 32, "price": 749, "base_type": "panel base", "style_tags": ["modern", "minimalist"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
            {"name": "Classic Tufted Sofa", "width_inches": 80, "height_inches": 22, "depth_inches": 36, "price": 1099, "base_type": "4 legs", "style_tags": ["traditional", "classic"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
        ],
        "desks": [
            {"name": "Minimalist Writing Desk", "width_inches": 48, "height_inches": 30, "depth_inches": 24, "price": 299, "base_type": "panel base", "style_tags": ["scandinavian", "minimalist"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
            {"name": "Adjustable Standing Desk", "width_inches": 55, "height_inches": 28, "depth_inches": 24, "price": 549, "base_type": "panel base", "style_tags": ["modern", "minimalist"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
        ],
        "dining chairs": [
            {"name": "Scandinavian Dining Chair", "width_inches": 18, "height_inches": 18, "depth_inches": 20, "price": 149, "base_type": "4 legs", "style_tags": ["scandinavian", "minimalist"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
            {"name": "Armless Side Chair", "width_inches": 17, "height_inches": 18, "depth_inches": 19, "price": 119, "base_type": "4 legs", "style_tags": ["modern", "minimalist"], "image_url": "https://via.placeholder.com/300", "product_url": "https://wayfair.com"},
        ],
    }
    return mocks.get(category.lower(), [])

async def crawl_wayfair(category: str, max_width: float):
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800},
                extra_http_headers={
                    "Accept-Language": "en-US,en;q=0.9",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                }
            )
            page = await context.new_page()

            url = f"https://www.wayfair.com/furniture/sb0/{category.replace(' ', '-')}-c45974.html"
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(4000)

            products = await page.evaluate("""() => {
                const cards = document.querySelectorAll('[data-testid="ProductCard"]');
                const results = [];
                cards.forEach(card => {
                    const name = card.querySelector('[data-testid="ProductCard-name"]')?.innerText || '';
                    const price = card.querySelector('[data-testid="ProductCard-price"]')?.innerText || '';
                    const img = card.querySelector('img')?.src || '';
                    const link = card.querySelector('a')?.href || '';
                    if (name) results.push({ name, price, img, link });
                });
                return results.slice(0, 10);
            }""")

            await browser.close()

            if not products:
                print(f"Crawl returned 0 products for {category}")
                return None

            formatted = []
            for prod in products:
                try:
                    price_str = ''.join(filter(str.isdigit, prod['price'].split('.')[0]))
                    price_num = float(price_str) if price_str else 299.0
                except:
                    price_num = 299.0

                formatted.append({
                    "name": prod['name'],
                    "width_inches": 60,
                    "height_inches": 18,
                    "depth_inches": 80,
                    "price": price_num,
                    "base_type": "panel base",
                    "category": category,
                    "style_tags": ["modern"],
                    "image_url": prod['img'],
                    "product_url": prod['link']
                })

            print(f"Crawl succeeded: {len(formatted)} products for {category}")
            return formatted

    except Exception as e:
        print(f"Crawl failed: {e}")
        return None

@app.post("/tools/wayfair-search")
async def wayfair_search(request: SearchRequest):
    real_results = await crawl_wayfair(request.category, request.max_width_inches)

    if real_results:
        products = real_results
    else:
        products = get_mock_products(request.category)

    filtered = [
        p for p in products
        if p["width_inches"] <= request.max_width_inches
    ]

    return {
        "category": request.category,
        "products": filtered,
        "source": "live" if real_results else "mock"
    }