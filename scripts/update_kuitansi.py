import re
import sys

def process(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove label prop
    content = re.sub(r'label,\s*', '', content)
    content = re.sub(r'label:\s*string;\s*', '', content)

    # 2. Remove <div className="copy-label">{label}</div>
    content = re.sub(r'<div className="copy-label">\{label\}</div>\s*', '', content)
    content = re.sub(r'\.copy-label\s*\{[^}]*\}\s*', '', content)

    # 3. Update ReceiptCopy usage
    content = re.sub(r'label="[^"]*"\s*', '', content)
    content = re.sub(r'<div className="copy-divider" />\s*<ReceiptCopy.*?/>\s*', '', content)
    content = re.sub(r'\.copy-divider\s*\{[^}]*\}\s*', '', content)
    content = re.sub(r'\.copy-divider\s*\{\s*margin:\s*0;\s*\}\s*', '', content)

    # 4. Add script
    content = re.sub(r'(<style>\{`)', r'<script dangerouslySetInnerHTML={{ __html: \'window.print();\' }} />\n      \1', content)

    # 5. Font weights
    content = content.replace('font-weight: 900;', 'font-weight: 700;')
    content = content.replace('font-weight: 800;', 'font-weight: 700;')

    # 6. Page rules
    content = re.sub(r'@page\s*\{\s*size:\s*A4\s*portrait;\s*margin:\s*0;\s*\}',
                     '@page {\n          size: 24cm 14cm;\n          margin: 1.5cm;\n        }', content)

    # 7. Receipt copy size
    content = re.sub(r'width:\s*210mm;\s*height:\s*147\.5mm;', 'width: 21cm;\n          height: 11cm;', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Processed {filepath}")

try:
    process('c:/DATA/eskahade/app/dashboard/psb/kuitansi/[id]/page.tsx')
    process('c:/DATA/eskahade/app/dashboard/keuangan/non-spp/kuitansi/[id]/page.tsx')
except Exception as e:
    print(f"Error: {e}")
