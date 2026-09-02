import re

class TextCleaner:
    @staticmethod
    def clean(text: str):
        text = text.replace("\x00", "")
        text = re.sub(r"\n+", "\n", text)
        text = re.sub(r"\s+", " ", text)
        text = text.strip()
        return text