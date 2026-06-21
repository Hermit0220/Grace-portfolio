import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'(<img src="button-remove-svgrepo-com\.svg" class="remove-btn" alt="Remove Photo"\s*style="display: none;">)\s*(</div>)')
replacement = r'\1\n                    <button class="polaroid-save-btn glass-btn" style="display: none;">Save</button>\n                \2'

new_content = pattern.sub(replacement, content)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)
