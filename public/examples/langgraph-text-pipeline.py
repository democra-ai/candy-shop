"""Self-contained LangGraph: a 3-node text-processing pipeline that does real
work with pure Python (no external API keys, no LLM needed).

Nodes:
  normalize  -> lowercases + strips the input text, records original length
  analyze    -> word/char counts, unique words, longest word
  summarize  -> builds a one-line stats summary and appends it as a message

The runner feeds {"messages": [("user", TASK)]} and streams stream_mode="values".
We expose a compiled graph as `graph`.
"""
from typing import Annotated, TypedDict
import operator

from langgraph.graph import StateGraph, START, END


class State(TypedDict):
    messages: Annotated[list, operator.add]
    text: str
    stats: dict


def _last_user_text(state: State) -> str:
    msgs = state.get("messages") or []
    if not msgs:
        return ""
    last = msgs[-1]
    # messages may be (role, content) tuples or message objects
    if isinstance(last, (list, tuple)) and len(last) == 2:
        return str(last[1])
    return str(getattr(last, "content", last))


def normalize(state: State):
    raw = _last_user_text(state)
    text = raw.strip()
    return {
        "text": text,
        "messages": [("assistant", f"[normalize] received {len(text)} chars")],
    }


def analyze(state: State):
    text = state.get("text", "")
    words = [w for w in __import__("re").findall(r"\b[\w']+\b", text)]
    unique = sorted(set(w.lower() for w in words))
    longest = max(words, key=len) if words else ""
    stats = {
        "word_count": len(words),
        "char_count": len(text),
        "unique_words": len(unique),
        "longest_word": longest,
    }
    return {
        "stats": stats,
        "messages": [("assistant", f"[analyze] {stats}")],
    }


def summarize(state: State):
    s = state.get("stats", {})
    summary = (
        f"Text has {s.get('word_count', 0)} words "
        f"({s.get('unique_words', 0)} unique), "
        f"{s.get('char_count', 0)} characters; "
        f"longest word: {s.get('longest_word', '')!r}."
    )
    return {"messages": [("assistant", f"[summary] {summary}")]}


_builder = StateGraph(State)
_builder.add_node("normalize", normalize)
_builder.add_node("analyze", analyze)
_builder.add_node("summarize", summarize)
_builder.add_edge(START, "normalize")
_builder.add_edge("normalize", "analyze")
_builder.add_edge("analyze", "summarize")
_builder.add_edge("summarize", END)

graph = _builder.compile()
