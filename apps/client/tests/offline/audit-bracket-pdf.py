"""Independently verify text, page size, match coverage and context in Chromium's print PDFs."""

import argparse
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

from pypdf import PdfReader


def compact(text: str) -> str:
    # Embedded subset fonts can introduce spaces around Vietnamese combining characters.
    text = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    return re.sub(r"[^\S\n]+", "", text)


parser = argparse.ArgumentParser()
parser.add_argument("--render", action="store_true")
args = parser.parse_args()
output = Path(__file__).resolve().parents[2] / "test-results/bracket-print"
rows = []
for form in ("singles", "doubles"):
    for locale in ("vi", "en"):
        for paper, expected_size in (("A4", (841.89, 595.28)), ("A3", (1190.55, 841.89))):
            file = output / f"{form}-{locale}-{paper}.pdf"
            reader = PdfReader(file)
            texts = [compact(page.extract_text()) for page in reader.pages]
            ids = [int(match) for text in texts for match in re.findall(r"(?m)^(?:Tran#|Match)([0-9]+)$", text)]
            all_text = "\n".join(texts)
            suffixes = ("A", "B") if form == "doubles" else ("A",)
            missing_names = [f"{number}{suffix}" for number in range(1, 65) for suffix in suffixes
                             if f"NguyenPhuongHoangMinhChau{number}{suffix}" not in all_text]
            context = "Printverificationtournament" if locale == "en" else "Giaikiemtrabanin"
            sizes = [(float(page.mediabox.width), float(page.mediabox.height)) for page in reader.pages]
            row = {
                "file": file.name, "pages": len(reader.pages), "sizes": sizes,
                "matchCount": len(ids), "matchCounts": dict(Counter(ids)),
                "contextOnEveryPage": all(context in text for text in texts), "missingNames": missing_names,
            }
            rows.append(row)
            assert len(reader.pages) == 5, row
            assert Counter(ids) == Counter(range(1, 64)), row
            assert row["contextOnEveryPage"] and not missing_names, row
            assert all(abs(width - expected_size[0]) < 2 and abs(height - expected_size[1]) < 2
                       for width, height in sizes), row

if args.render:
    import pymupdf

    for filename, pages in (("doubles-vi-A4", (0, 3, 4)), ("doubles-en-A3", (0,))):
        document = pymupdf.open(output / f"{filename}.pdf")
        for index in pages:
            document[index].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5)).save(output / f"{filename}-page-{index + 1}.png")

(output / "pdf-audit.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Verified {len(rows)} PDFs: five landscape sheets each, 63 unique matches, full long names and repeated context.")
