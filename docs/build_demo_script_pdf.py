"""Build a downloadable PDF of the ExamNexus demo narration script."""

from __future__ import annotations

import re
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(__file__).with_name("DEMO_WALKTHROUGH_SCRIPT.md")
OUTPUTS = [
    Path(__file__).with_name("DEMO_WALKTHROUGH_SCRIPT.pdf"),
    ROOT / "public" / "downloads" / "ExamNexus-Demo-Walkthrough-Script.pdf",
]

TEAL = (13, 148, 136)
TEAL_DARK = (15, 78, 74)
INK = (23, 37, 42)
MUTED = (71, 85, 90)
RULE = (203, 213, 214)
CUE_BG = (240, 253, 250)
PAUSE_BG = (255, 247, 237)
WHITE = (255, 255, 255)

FONT_DIR = Path(r"C:\Windows\Fonts")
FONT_REGULAR = FONT_DIR / "calibri.ttf"
FONT_BOLD = FONT_DIR / "calibrib.ttf"
FONT_ITALIC = FONT_DIR / "calibrii.ttf"
FONT_BOLD_ITALIC = FONT_DIR / "calibriz.ttf"


def strip_md(text: str) -> str:
    text = text.replace("**", "")
    text = text.replace("`", "")
    return text.strip()


class ScriptPDF(FPDF):
    def __init__(self) -> None:
        super().__init__(format="A4", unit="mm")
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(16, 22, 16)
        self.add_font("Calibri", "", str(FONT_REGULAR))
        self.add_font("Calibri", "B", str(FONT_BOLD))
        self.add_font("Calibri", "I", str(FONT_ITALIC))
        self.add_font("Calibri", "BI", str(FONT_BOLD_ITALIC))
        self.set_title("ExamNexus — Demo narration script")
        self.set_author("ExamNexus")
        self.set_creator("ExamNexus")

    def header(self) -> None:
        self.set_fill_color(*TEAL)
        self.rect(0, 0, 210, 12, "F")
        self.set_xy(16, 3.2)
        self.set_font("Calibri", "B", 10)
        self.set_text_color(*WHITE)
        self.cell(0, 6, "ExamNexus  ·  Intelligent Assessment Platform", align="L")
        self.set_xy(16, 3.2)
        self.set_font("Calibri", "", 9)
        self.cell(0, 6, "Demo narration script", align="R")
        self.set_text_color(*INK)
        self.set_y(18)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_draw_color(*RULE)
        self.set_line_width(0.2)
        self.line(16, self.get_y(), 194, self.get_y())
        self.set_y(-10)
        self.set_font("Calibri", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 6, f"Page {self.page_no()}", align="C")
        self.set_text_color(*INK)

    def ensure_space(self, height: float) -> None:
        if self.get_y() + height > self.page_break_trigger:
            self.add_page()

    def h1(self, text: str) -> None:
        self.set_font("Calibri", "B", 20)
        self.set_text_color(*TEAL_DARK)
        self.multi_cell(0, 8, text)
        self.ln(1)
        self.set_draw_color(*TEAL)
        self.set_line_width(0.7)
        y = self.get_y()
        self.line(16, y, 70, y)
        self.ln(6)
        self.set_text_color(*INK)

    def h2(self, text: str) -> None:
        self.ln(3)
        self.ensure_space(16)
        self.set_fill_color(*TEAL)
        x, y = 16, self.get_y()
        self.rect(x, y, 1.6, 8.5, "F")
        self.set_xy(x + 5, y)
        self.set_font("Calibri", "B", 13)
        self.set_text_color(*TEAL_DARK)
        self.multi_cell(173, 8.5, text)
        self.ln(2)
        self.set_text_color(*INK)

    def body(self, text: str, size: int = 11, leading: float = 5.6) -> None:
        if not text:
            return
        self.set_font("Calibri", "", size)
        self.set_text_color(*INK)
        self.multi_cell(0, leading, text)
        self.ln(1.5)

    def muted(self, text: str) -> None:
        self.set_font("Calibri", "I", 10)
        self.set_text_color(*MUTED)
        self.multi_cell(0, 5.2, text)
        self.ln(2)
        self.set_text_color(*INK)

    def callout(self, label: str, text: str, fill: tuple[int, int, int], accent: tuple[int, int, int]) -> None:
        self.set_font("Calibri", "I", 10)
        width = 178
        lines = self.multi_cell(width - 8, 5.2, text, dry_run=True, output="LINES")
        height = 7 + max(1, len(lines)) * 5.2 + 3
        self.ensure_space(height + 2)
        x, y = 16, self.get_y()
        self.set_fill_color(*fill)
        self.set_draw_color(*accent)
        self.set_line_width(0.3)
        self.rect(x, y, width, height, "FD")
        self.set_fill_color(*accent)
        self.rect(x, y, 1.8, height, "F")
        self.set_xy(x + 5, y + 2)
        self.set_font("Calibri", "B", 8.5)
        self.set_text_color(*accent)
        self.cell(0, 4.5, label)
        self.set_xy(x + 5, y + 7)
        self.set_font("Calibri", "I" if label == "ON SCREEN" else "", 10.5)
        self.set_text_color(*INK)
        self.multi_cell(width - 8, 5.2, text)
        self.set_y(y + height + 2.5)

    def pause_box(self) -> None:
        self.ensure_space(12)
        self.set_fill_color(*PAUSE_BG)
        self.set_draw_color(194, 120, 60)
        self.rect(16, self.get_y(), 178, 9, "FD")
        self.set_xy(16, self.get_y() + 1.8)
        self.set_font("Calibri", "BI", 10)
        self.set_text_color(146, 64, 14)
        self.cell(178, 5.4, "PAUSE  —  read the lockdown rules slowly", align="C")
        self.ln(10)
        self.set_text_color(*INK)

    def kv_table(self, rows: list[tuple[str, str]]) -> None:
        self.ensure_space(12 + len(rows) * 8)
        col1, col2 = 42, 136
        self.set_font("Calibri", "", 10)
        for i, (key, value) in enumerate(rows):
            fill = (247, 250, 250) if i % 2 == 0 else WHITE
            self.set_fill_color(*fill)
            y = self.get_y()
            self.rect(16, y, col1 + col2, 8, "F")
            self.set_xy(18, y + 1.5)
            self.set_font("Calibri", "B", 10)
            self.set_text_color(*TEAL_DARK)
            self.cell(col1 - 4, 5, key)
            self.set_xy(16 + col1, y + 1.5)
            self.set_font("Calibri", "", 10)
            self.set_text_color(*INK)
            self.cell(col2 - 2, 5, value)
            self.set_y(y + 8)
        self.ln(4)

    def grid_table(self, headers: list[str], rows: list[list[str]], widths: list[float]) -> None:
        self.ensure_space(14 + len(rows) * 8)
        self.set_fill_color(*TEAL)
        self.set_text_color(*WHITE)
        self.set_font("Calibri", "B", 9.5)
        x = 16
        y = self.get_y()
        for w, h in zip(widths, headers):
            self.set_xy(x, y)
            self.cell(w, 7.5, h, fill=True)
            x += w
        self.set_y(y + 7.5)
        self.set_text_color(*INK)
        for i, row in enumerate(rows):
            fill = (240, 253, 250) if i % 2 == 0 else WHITE
            self.set_fill_color(*fill)
            self.set_font("Calibri", "B" if row[0].strip().startswith("Total") else "", 9.5)
            x = 16
            y = self.get_y()
            for w, cell in zip(widths, row):
                self.set_xy(x, y)
                self.cell(w, 7, cell, fill=True)
                x += w
            self.set_y(y + 7)
        self.ln(4)

    def bullet(self, text: str, ordered: str | None = None) -> None:
        self.ensure_space(10)
        marker = ordered if ordered is not None else "•"
        self.set_font("Calibri", "B" if ordered else "", 11)
        self.set_text_color(*(TEAL if ordered else INK))
        x = self.get_x()
        y = self.get_y()
        self.set_xy(18, y)
        self.cell(8, 5.6, marker)
        self.set_xy(26, y)
        self.set_font("Calibri", "", 11)
        self.set_text_color(*INK)
        self.multi_cell(166, 5.6, text)
        self.ln(0.8)


def parse_table_row(line: str) -> list[str]:
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    return [strip_md(c) for c in cells]


def render_markdown(pdf: ScriptPDF, markdown: str) -> None:
    lines = markdown.replace("\r\n", "\n").split("\n")
    i = 0
    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        stripped = line.strip()

        if not stripped:
            i += 1
            continue
        if stripped == "---":
            i += 1
            continue
        if stripped.startswith("**Download:**") or stripped.startswith("Download:"):
            i += 1
            continue

        if stripped.startswith("# "):
            pdf.h1(strip_md(stripped[2:]))
            i += 1
            continue

        if stripped.startswith("## "):
            pdf.h2(strip_md(stripped[3:]))
            i += 1
            continue

        if stripped.startswith("|") and i + 1 < len(lines) and re.match(r"^\|?\s*-+", lines[i + 1].strip()):
            headers = parse_table_row(stripped)
            i += 2
            rows: list[list[str]] = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(parse_table_row(lines[i]))
                i += 1
            if headers == ["", ""] or (len(headers) == 2 and headers[0] == ""):
                pdf.kv_table([(row[0], row[1]) for row in rows if len(row) >= 2])
            else:
                usable = len(headers)
                widths = [178 / usable] * usable
                if usable == 3:
                    widths = [78, 40, 60]
                pdf.grid_table(headers, [r[:usable] for r in rows], widths)
            continue

        if stripped.startswith("`[ON SCREEN]`") or stripped.startswith("[ON SCREEN]"):
            text = strip_md(re.sub(r"^`?\[ON SCREEN\]`?\s*", "", stripped))
            pdf.callout("ON SCREEN", text, CUE_BG, TEAL)
            i += 1
            continue

        if stripped in {"**(pause)**", "(pause)"}:
            pdf.pause_box()
            i += 1
            continue

        if stripped == "**Spoken**":
            pdf.ensure_space(10)
            pdf.set_font("Calibri", "B", 8.5)
            pdf.set_text_color(*TEAL)
            pdf.cell(0, 5, "SPOKEN")
            pdf.ln(1)
            pdf.set_text_color(*INK)
            i += 1
            continue

        if stripped.startswith("**") and stripped.endswith("**") and " — " not in stripped[:24]:
            pdf.set_font("Calibri", "B", 11)
            pdf.set_text_color(*TEAL_DARK)
            pdf.multi_cell(0, 6, strip_md(stripped))
            pdf.ln(1)
            i += 1
            continue

        ordered = re.match(r"^(\d+)\.\s+(.*)$", stripped)
        if ordered:
            pdf.bullet(strip_md(ordered.group(2)), ordered=ordered.group(1) + ".")
            i += 1
            continue

        if stripped.startswith("- "):
            pdf.bullet(strip_md(stripped[2:]))
            i += 1
            continue

        pdf.body(strip_md(stripped))
        i += 1


def main() -> None:
    markdown = SOURCE.read_text(encoding="utf-8")
    pdf = ScriptPDF()
    pdf.add_page()
    render_markdown(pdf, markdown)

    data = pdf.output()
    for path in OUTPUTS:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(bytes(data))
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()
