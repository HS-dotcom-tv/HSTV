import requests
import json
import os
from datetime import datetime, timezone, timedelta

# --- Configuration ---
# احصل على مفاتيح الـ API من متغيرات البيئة (GitHub Secrets)
FOOTBALL_DATA_API_KEY_ENV = os.environ.get('API_TEAMDATA_KEY') # تم التعديل ليطابق API_TEAMDATA_KEY
NEWS_API_KEY_ENV = os.environ.get('NEWS_API_KEY')

# معرف الدوري الإسباني (La Liga) في Football-Data.org v4
LA_LIGA_COMPETITION_ID = 2014 # 2014 هو معرف La Liga في Football-Data.org v4

# لغة الأخبار (ar للعربية، en للإنجليزية)
NEWS_LANGUAGE = 'ar' 

# الكلمات المفتاحية للأخبار
NEWS_KEYWORDS = 'كرة قدم الدوري الاسباني ريال مدريد برشلونة' 

# عدد المقالات الإخبارية المراد جلبها
NEWS_PAGE_SIZE = 10 

# --- API Headers ---
FOOTBALL_DATA_HEADERS = {
    'X-Auth-Token': FOOTBALL_DATA_API_KEY_ENV, # استخدام المتغير المعدل
    'Accept': 'application/json'
}

# --- API Base URLs ---
FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4'
NEWS_API_BASE_URL = 'https://newsapi.org/v2'

# --- Functions ---

def fetch_football_standings():
    """Fetches La Liga standings from Football-Data.org."""
    print("🔄 Fetching La Liga standings...")
    if not FOOTBALL_DATA_API_KEY_ENV:
        print("❌ Football Data API Key (API_TEAMDATA_KEY) not found.")
        return None

    url = f"{FOOTBALL_DATA_BASE_URL}/competitions/{LA_LIGA_COMPETITION_ID}/standings"
    try:
        response = requests.get(url, headers=FOOTBALL_DATA_HEADERS)
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        data = response.json()
        
        standings_list = []
        for standing in data.get('standings', []):
            if standing.get('type') == 'TOTAL':
                for table_row in standing.get('table', []):
                    team = table_row.get('team', {})
                    standings_list.append({
                        'position': table_row.get('position'),
                        'team_id': team.get('id'),
                        'team_name': team.get('name'),
                        'team_crest': team.get('crest'),
                        'played_games': table_row.get('playedGames'),
                        'won': table_row.get('won'),
                        'draw': table_row.get('draw'),
                        'lost': table_row.get('lost'),
                        'points': table_row.get('points'),
                        'goals_for': table_row.get('goalsFor'),
                        'goals_against': table_row.get('goalsAgainst'),
                        'goal_difference': table_row.get('goalDifference')
                    })
                break 

        print(f"✅ Fetched {len(standings_list)} teams standings.")
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": "football-data.org",
            "competition_name": data.get('competition', {}).get('name'),
            "competition_area": data.get('competition', {}).get('area', {}).get('name'),
            "standings": standings_list
        }
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching football standings: {e}")
        return None

def fetch_football_news():
    """Fetches football news from NewsAPI.org."""
    print("🔄 Fetching football news...")
    if not NEWS_API_KEY_ENV:
        print("❌ News API Key (NEWS_API_KEY) not found.")
        return None

    encoded_keywords = requests.utils.quote(NEWS_KEYWORDS)
    url = f"{NEWS_API_BASE_URL}/everything?q={encoded_keywords}&language={NEWS_LANGUAGE}&sortBy=publishedAt&pageSize={NEWS_PAGE_SIZE}&apiKey={NEWS_API_KEY_ENV}"
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        news_list = []
        for article in data.get('articles', []):
            if article.get('title') and article.get('description') and article.get('url'):
                news_list.append({
                    'title': article['title'],
                    'description': article['description'],
                    'url': article['url'],
                    'image_url': article.get('urlToImage'),
                    'published_at': article.get('publishedAt'),
                    'source': article.get('source', {}).get('name')
                })
        
        print(f"✅ Fetched {len(news_list)} news articles.")
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": "newsapi.org",
            "articles": news_list
        }
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching news: {e}")
        return None

def save_json_data(filename, data):
    """Saves data to a JSON file."""
    if data:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f"✅ Data saved to {filename}.")
    else:
        print(f"⚠️ No data to save for {filename}.")

# --- Main execution ---
if __name__ == "__main__":
    standings = fetch_football_standings()
    save_json_data('football_standings.json', standings)

    news = fetch_football_news()
    save_json_data('football_news.json', news)

    print("🏁 Data fetching process completed.")
