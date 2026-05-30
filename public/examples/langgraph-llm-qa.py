"""Self-contained LangGraph that DOES use an LLM, via the sandbox's Workers-AI
OpenAI shim (no external API key needed — the worker sets OPENAI_BASE_URL /
OPENAI_API_KEY for us).

Two real nodes:
  answer   -> calls the chat model to answer the user's question concisely
  tag      -> a pure-Python node that labels the answer's length bucket

Exposes a compiled graph as `graph`. The model is created with a permissive
fallback chain so it works whether langchain_openai or init_chat_model is the
available entrypoint in the image.
"""
import os
from typing import Annotated, TypedDict
import operator

from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage


def _make_model():
    # The worker points these at its Workers-AI-backed OpenAI shim.
    base = os.environ.get("OPENAI_BASE_URL") or os.environ.get("OPENAI_API_BASE")
    key = os.environ.get("OPENAI_API_KEY", "internal")
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(model="gpt-4o-mini", api_key=key, base_url=base, temperature=0.2, max_tokens=256)


class State(TypedDict):
    messages: Annotated[list, operator.add]
    answer: str


def _last_user_text(state):
    msgs = state.get("messages") or []
    if not msgs:
        return ""
    last = msgs[-1]
    if isinstance(last, (list, tuple)) and len(last) == 2:
        return str(last[1])
    return str(getattr(last, "content", last))


def answer(state: State):
    question = _last_user_text(state)
    model = _make_model()
    resp = model.invoke([
        SystemMessage(content="You are a concise expert assistant. Answer in 2-3 sentences."),
        HumanMessage(content=question),
    ])
    text = resp.content if hasattr(resp, "content") else str(resp)
    return {"answer": text, "messages": [AIMessage(content=text)]}


def tag(state: State):
    ans = state.get("answer", "") or ""
    n = len(ans.split())
    bucket = "short" if n < 25 else ("medium" if n < 60 else "long")
    return {"messages": [("assistant", f"[meta] answer length: {n} words ({bucket})")]}


_builder = StateGraph(State)
_builder.add_node("answer", answer)
_builder.add_node("tag", tag)
_builder.add_edge(START, "answer")
_builder.add_edge("answer", "tag")
_builder.add_edge("tag", END)

graph = _builder.compile()
