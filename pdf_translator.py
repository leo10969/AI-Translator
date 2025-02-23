import sys
import os
from PyPDF2 import PdfReader
from google import genai
import json
from dotenv import load_dotenv

def extract_text_from_pdf(pdf_path):
    reader = PdfReader(pdf_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    return text

def translate_text(text, translation_style, translation_format, target_language, text_style='dearu', punctuation_style='ten', dictionary=None):
    load_dotenv()
    client = genai.Client(api_key=os.environ.get("API_KEY"))

    # 言語コードを言語名に変換
    language_names = {
        'ja': '日本語',
        'en': '英語',
        'zh': '中国語',
        'ko': '韓国語',
        'fr': 'フランス語',
        'de': 'ドイツ語'
    }

    # 翻訳形式に応じてプロンプトを調整
    format_prompts = {
        'simple': f'''以下の文章を{language_names[target_language]}に翻訳してください。
入力文と同じ形式（改行の有無など）で翻訳結果を返してください。
翻訳結果のみを返してください：

入力文: ''',

        'parallel': f'''以下の文章を{language_names[target_language]}に翻訳し、以下の形式で返してください。
入力文を「。」で区切り、各文に対して以下の形式で出力してください：

[原文]
文章1
[翻訳]
翻訳文1

[原文]
文章2
[翻訳]
翻訳文2

入力文: ''',

        'detailed': f'''以下の文章を{language_names[target_language]}に翻訳し、以下の形式で返してください：

1. 翻訳文
（各文章の後に改行を入れてください）

2. 重要な単語や表現の解説（3つ程度）
・[単語/表現]（出現箇所）：
  - 意味：基本的な意味と文脈での意味
  - 品詞：品詞の説明
  - 活用/時制：動詞の場合は活用形、時制など
  - 用例：他の一般的な使用例
  - 関連表現：類義語、反意語など

入力文: '''
    }

    # スタイルと形式を組み合わせてプロンプトを生成
    base_prompt = format_prompts.get(translation_format, format_prompts['simple'])

    # 辞書情報をプロンプトに追加
    dictionary_prompt = ""
    if dictionary:
        try:
            dict_data = json.loads(dictionary) if isinstance(dictionary, str) else dictionary
            if dict_data:
                dictionary_prompt = '''
以下の単語・表現は、必ず指定された訳語を使用してください：

'''
                for entry in dict_data:
                    if isinstance(entry, dict) and 'sourceWord' in entry and 'targetWord' in entry:
                        dictionary_prompt += f"・{entry['sourceWord']} → {entry['targetWord']}"
                        if 'description' in entry and entry['description']:
                            dictionary_prompt += f"（{entry['description']}）"
                        dictionary_prompt += "\n"
        except json.JSONDecodeError:
            print("Warning: Dictionary data could not be parsed", file=sys.stderr)
            dictionary_prompt = ""

    # 日本語用の文体指定を追加
    if target_language == 'ja':
        style_prefix = f'''以下の条件で翻訳してください：
- {'自然な' if translation_style == 'natural' else '直訳的な'}翻訳
- {'「だ・である」調' if text_style == 'dearu' else '「です・ます」調'}の文体
- {'句読点は「，」「．」' if punctuation_style == 'comma' else '句読点は「、」「。」'}を使用
{dictionary_prompt}
'''
    else:
        style_prefix = f'''以下の条件で翻訳してください：
- {'自然な' if translation_style == 'natural' else '直訳的な'}翻訳
{dictionary_prompt}
'''

    prompt_text = f"{style_prefix}{base_prompt}{text}"

    response = client.models.generate_content(
        model="gemini-2.0-flash", contents=prompt_text
    )
    return response.text

def main():
    if len(sys.argv) < 8:
        print("Usage: python3 pdf_translator.py pdf_path translation_style translation_format target_language text_style punctuation_style dictionary")
        sys.exit(1)

    pdf_path = sys.argv[1]
    translation_style = sys.argv[2]
    translation_format = sys.argv[3]
    target_language = sys.argv[4]
    text_style = sys.argv[5]
    punctuation_style = sys.argv[6]
    dictionary = json.loads(sys.argv[7])

    # PDFからテキストを抽出
    text = extract_text_from_pdf(pdf_path)

    # テキストを翻訳
    translated_text = translate_text(
        text,
        translation_style,
        translation_format,
        target_language,
        text_style,
        punctuation_style,
        dictionary
    )

    print(translated_text)

if __name__ == "__main__":
    main() 