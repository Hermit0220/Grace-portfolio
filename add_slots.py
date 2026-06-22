import re

with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Add data-slot='photo-N' to each photo-upload-container
for i in range(1, 11):
    old = f'class="photo-upload-container photo-{i}"'
    new = f'class="photo-upload-container photo-{i}" data-slot="photo-{i}"'
    content = content.replace(old, new)

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done! Added data-slot attributes to all 10 containers.')
