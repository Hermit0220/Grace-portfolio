import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

def replace_placeholder(match):
    num = match.group(1)
    new_html = f'''<div class="photo-upload-container photo-{num}">
                    <input type="file" class="file-input" id="file-input-{num}" accept="image/*" hidden>
                    <div class="upload-content">
                        <svg class="add-icon" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        <span>Add Photo</span>
                    </div>
                    <img class="uploaded-img" src="" alt="Photo {num}" style="display: none;">
                </div>'''
    return new_html

new_content = re.sub(
    r'<div class="photo-upload-container photo-(\d+)">.*?</div>',
    replace_placeholder,
    content,
    flags=re.DOTALL
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Updated index.html')
