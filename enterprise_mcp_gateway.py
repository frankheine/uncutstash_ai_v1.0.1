import os
import requests
from fastmcp import FastMCP

# Initialize the MCP Server
mcp = FastMCP("Enterprise_Private_AI_Gateway")

# Correctly fetch the environment variable configured in your JSON
LM_STUDIO_URL = os.getenv("LM_STUDIO_ENDPOINT", "http://localhost:1234/v1/chat/completions")

@mcp.tool()
def query_local_llm(prompt: str, model_name: str = "qwen3-1.7B-magic_decensored-i1") -> str:
    """
    Queries the locally hosted private LLM inside LM Studio. 
    Use this tool for zero-data-leakage tasks containing private corporate data.
    """
    headers = {"Content-Type": "application/json"}
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2
    }
    
    try:
        # Pass the clean variable name here, not a raw text URL
        response = requests.post(LM_STUDIO_URL, json=payload, headers=headers)
        if response.status_code == 200:
            return response.json()["choices"][0]["message"]["content"]
        else:
            return f"LM Studio Error ({response.status_code}): {response.text}"
    except Exception as e:
        return f"Could not reach LM Studio local endpoint. Verify server status. Details: {str(e)}"

@mcp.tool()
def search_company_knowledgebase(query: str, client_id: str = "default_biz") -> str:
    """
    Queries the enterprise Vector Database (RAG system) to fetch proprietary semantic data.
    """
    mock_context = f"[Vector DB Context for '{query}']: Internal Memo 2026 states all client assets must be stored using private local endpoints."
    return mock_context

if __name__ == "__main__":
    mcp.run()