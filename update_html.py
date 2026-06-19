import re

with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

def inject_btn(match):
    return match.group(1) + '\n                    <img src="button-remove-svgrepo-com.svg" class="remove-btn" alt="Remove Photo" style="display: none;">\n                </div>'

new_content = re.sub(
    r'(<img class="uploaded-img" src="" alt="Photo \d+" style="display: none;">\s*)</div>',
    inject_btn,
    content
)

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Updated index.html')
