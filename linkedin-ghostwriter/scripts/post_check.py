"""Rule-based LinkedIn post checker. No AI model, standard library only.

Usage: python3 post_check.py draft.txt
Exit code 1 if any FAIL, so it can gate a pipeline.
"""
import re
import sys

BANNED = [
    "game-changer", "game changer", "revolutionary", "supercharge", "unlock",
    "delve", "let that sink in", "in today's fast-paced world",
    "i'm thrilled to announce", "i am thrilled to announce",
    "what if i told you", "agree?", "comment yes", "tag someone",
]
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿]")


def check(text):
    text = text.strip()
    lines = [l for l in text.splitlines() if l.strip()]
    first = lines[0].strip() if lines else ""
    paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    longest_par = max((len(p.split()) for p in paragraphs), default=0)
    hashtags = re.findall(r"(?<!\w)#\w+", text)
    lowered = text.lower()
    banned_hits = [b for b in BANNED if b in lowered]
    verify_tags = re.findall(r"\[VERIFY[^\]]*\]", text)

    return [
        ("FAIL", "Hook is 100 chars or fewer", len(first) <= 100, f"{len(first)} chars"),
        ("FAIL", "Length is 600-1800 chars", 600 <= len(text) <= 1800, f"{len(text)} chars"),
        ("FAIL", "At most 3 hashtags", len(hashtags) <= 3, f"{len(hashtags)} found"),
        ("FAIL", "No banned phrases", not banned_hits, ", ".join(banned_hits) or "none"),
        ("WARN", "At most 3 emoji", len(EMOJI.findall(text)) <= 3, f"{len(EMOJI.findall(text))} found"),
        ("WARN", "No paragraph over 45 words", longest_par <= 45, f"longest is {longest_par} words"),
        ("WARN", "Has 5+ paragraphs for readability", len(paragraphs) >= 5, f"{len(paragraphs)} found"),
        ("WARN", "No unresolved [VERIFY] tags", not verify_tags, f"{len(verify_tags)} open"),
    ]


if __name__ == "__main__":
    text = open(sys.argv[1], encoding="utf-8").read() if len(sys.argv) > 1 else sys.stdin.read()
    results = check(text)
    for level, name, ok, info in results:
        print(("PASS" if ok else level), "|", name, "-", info)
    fails = sum(1 for level, _, ok, _ in results if not ok and level == "FAIL")
    warns = sum(1 for level, _, ok, _ in results if not ok and level == "WARN")
    print(f"\n{fails} fail, {warns} warn")
    sys.exit(1 if fails else 0)
