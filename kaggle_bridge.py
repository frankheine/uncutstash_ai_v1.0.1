import sys
import json
import os
import urllib.request
import urllib.parse
import time
import re
from duckduckgo_search import DDGS

# ==========================================
# CORE TUNNEL CONNECTIONS & LOCAL DATA PATHS
# ==========================================
base_url = os.environ.get("KAGGLE_TUNNEL_URL").rstrip("/")
TUNNEL_URL = f"{base_url}/api/generate"
MODEL_NAME = "antigravity-pm-model"
DB_FILE = os.path.join(os.path.dirname(__file__), "sovereign_recall_db.json")

# ==========================================
# ALGORITHMIC LOCAL RE-RANKING CORE
# ==========================================
def tokenize(text):
    return re.findall(r'\w+', text.lower())

def calculate_score(query_tokens, doc_text):
    doc_tokens = tokenize(doc_text)
    if not doc_tokens: 
        return 0.0
    score = 0.0
    doc_len = len(doc_tokens)
    for token in query_tokens:
        count = doc_tokens.count(token)
        if count > 0:
            score += (count / doc_len * 1.5) + (1.0 / (doc_tokens.index(token) + 1))
    return score

def get_relevant_history(query, top_k=4):
    if not os.path.exists(DB_FILE): 
        return []
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            database = json.load(f)
    except Exception: 
        return []
    
    query_tokens = tokenize(query)
    if not query_tokens: 
        return database[-top_k:]
    
    ranked_docs = []
    for entry in database:
        content = f"{entry.get('prompt', '')} {entry.get('response', '')}"
        score = calculate_score(query_tokens, content)
        ranked_docs.append((score, entry))
    
    ranked_docs.sort(key=lambda x: x[0], reverse=True)
    return [doc[1] for doc in ranked_docs[:top_k] if doc[0] > 0.0]

def append_to_permanent_db(prompt, response):
    database = []
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r", encoding="utf-8") as f: 
                database = json.load(f)
        except Exception: 
            pass
    database.append({
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "prompt": prompt,
        "response": response
    })
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(database, f, indent=2, ensure_ascii=False)

# ==========================================
# PRODUCTION-GRADE FULL TEXT SEARCH ENGINE
# ==========================================
def query_live_web(query):
    """
    Connects natively to DuckDuckGo API. Extracts titles, links, 
    and full descriptive body paragraphs within our 2026 timeline limit.
    """
    try:
        time_restricted_query = f"{query} after:2026-05-14"
        with DDGS() as ddgs:
            results = ddgs.text(time_restricted_query, max_results=5)
            if not results:
                return "No matching hyper-recent 2026 documentation resolved online."
            
            formatted_hits = []
            for r in results:
                formatted_hits.append(
                    f"Title: {r.get('title')}\n"
                    f"URL: {r.get('href')}\n"
                    f"Context Snippet: {r.get('body')}\n"
                    f"---"
                )
            return "\n".join(formatted_hits)
    except Exception as e:
        return f"Search bridge paused. Defaulting to offline execution models. Details: {str(e)}"

# ==========================================
# PIPELINE GENERATOR & HANDSHAKE RESOLVER
# ==========================================
def call_kaggle_llm(user_input):
    historical_matches = get_relevant_history(user_input, top_k=4)
    fresh_web_context = query_live_web(user_input)

    context_builder = [
        "🤖 SYSTEM CONTEXT PROFILE: PERFECT RECALL PROTOCOL ACTIVE 🤖",
        "Memory truncation is disabled. Relevant logs have been recovered with 100% fidelity.",
        "\n==========================================",
        "📅 STRICT TIMELINE SCOPE REFERENCE 📅",
        "Today is Saturday, June 13, 2026. Data originating before May 14, 2026, is deprecated.",
        "\n==========================================",
        "🔍 RE-RANKED HISTORICAL WORKSPACE CONTEXT 🔍"
    ]

    for idx, item in enumerate(historical_matches):
        context_builder.append(f"\n[Past Interaction #{idx+1} - {item.get('timestamp')}]")
        context_builder.append(f"Prompt: {item.get('prompt')}")
        context_builder.append(f"Output: {item.get('response')}")

    context_builder.append("\n==========================================")
    context_builder.append("🌐 DEEP DUCKDUCKGO LIVE INDEX INTERNET SEARCH 🌐")
    context_builder.append(fresh_web_context)
    context_builder.append("\n==========================================")
    context_builder.append(f"\n🚀 IMMEDIATE LIVE PROMPT TASK:\n{user_input}")

    payload = {
        "model": MODEL_NAME,
        "prompt": "\n".join(context_builder),
        "stream": False
    }

    try:
        req = urllib.request.Request(
            TUNNEL_URL, 
            data=json.dumps(payload).encode('utf-8'), 
            headers={
                "ngrok-skip-browser-warning": "true", 
                "Content-Type": "application/json"
            },
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=90) as response:
            result = json.loads(response.read().decode('utf-8'))
            model_response = result.get("response", "Error: Empty string returned from engine.")
            append_to_permanent_db(user_input, model_response)
            return model_response
    except Exception as e:
        return f"❌ Pipeline Connection Error: Verify your Kaggle instance is online.\nConnection Destination: {TUNNEL_URL}\nDetails: {str(e)}"

# ==========================================
# STANDARD JSON-RPC 2.0 PROTOCOL ROUTER
# ==========================================
def send_jsonrpc(response_dict):
    sys.stdout.write(json.dumps(response_dict) + "\n")
    sys.stdout.flush()

def main():
    while True:
        try:
            line = sys.stdin.readline()
            if not line: 
                break
            request = json.loads(line)
            req_id = request.get("id")
            method = request.get("method")

            if method == "initialize":
                send_jsonrpc({
                    "jsonrpc": "2.0", "id": req_id,
                    "result": {
                        "protocolVersion": "2024-11-05", 
                        "capabilities": {}, 
                        "serverInfo": {"name": "kaggle-pm-core", "version": "2.0"}
                    }
                })
            
            elif method == "tools/list":
                send_jsonrpc({
                    "jsonrpc": "2.0", "id": req_id,
                    "result": {
                        "tools": [{
                            "name": "kaggle-pm-core",
                            "description": "Routes prompts to Kaggle hardware with perfect local disk recall and full live web search.",
                            "inputSchema": {
                                "type": "object", 
                                "properties": {"prompt": {"type": "string"}}, 
                                "required": ["prompt"]
                            }
                        }]
                    }
                })
            
            elif method == "tools/call":
                params = request.get("params", {})
                arguments = params.get("arguments", {})
                user_prompt = arguments.get("prompt", "")
                
                output_content = call_kaggle_llm(user_prompt)
                
                send_jsonrpc({
                    "jsonrpc": "2.0", "id": req_id,
                    "result": {"content": [{"type": "text", "text": output_content}]}
                })
        except Exception:
            pass

if __name__ == "__main__":
    main()