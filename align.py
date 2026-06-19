import cv2
import numpy as np
import os

base_dir = r"C:\Users\ThinkPad\Desktop\Projects\Grace-portfolio\public\Image assets\4th page"
ref_path = os.path.join(base_dir, "Brown Red Flower Scrapbook Creative Portfolio Presentation (4).png")
frames_path = os.path.join(base_dir, "Brown Red Flower Scrapbook Creative Portfolio Presentation (2).png")
text_path = os.path.join(base_dir, "Brown Red Flower Scrapbook Creative Portfolio Presentation (3).png")

ref_img = cv2.imread(ref_path, cv2.IMREAD_UNCHANGED)
frames_img = cv2.imread(frames_path, cv2.IMREAD_UNCHANGED)
text_img = cv2.imread(text_path, cv2.IMREAD_UNCHANGED)

def find_template(template, ref):
    ref_gray = cv2.cvtColor(ref, cv2.COLOR_BGRA2GRAY)
    template_gray = cv2.cvtColor(template, cv2.COLOR_BGRA2GRAY)
    mask = template[:, :, 3]
    res = cv2.matchTemplate(ref_gray, template_gray, cv2.TM_CCORR_NORMED, mask=mask)
    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)
    x, y = max_loc
    h, w = template.shape[:2]
    return x, y, w, h

print("Matching frames (2.png)...")
fx, fy, fw, fh = find_template(frames_img, ref_img)
print(f"Frames: x={fx}, y={fy}, w={fw}, h={fh}")

new_img_path = os.path.join(base_dir, "Brown Red Flower Scrapbook Creative Portfolio Presentation (5).png")
new_img = cv2.imread(new_img_path, cv2.IMREAD_UNCHANGED)

print("Matching new image (5.png)...")
nx, ny, nw, nh = find_template(new_img, ref_img)
print(f"New Image: x={nx}, y={ny}, w={nw}, h={nh}")

print(f".p4-new-img {{")
print(f"    position: absolute;")
print(f"    left: {nx/ref_img.shape[1]*100:.2f}%;")
print(f"    top: {ny/ref_img.shape[0]*100:.2f}%;")
print(f"    width: {nw/ref_img.shape[1]*100:.2f}%;")
print(f"    height: {nh/ref_img.shape[0]*100:.2f}%;")
print(f"    pointer-events: none;")
print(f"}}")
print(f"Text: x={tx}, y={ty}, w={tw}, h={th}")

print("\n--- CSS Coordinates ---")
ref_h, ref_w = ref_img.shape[:2]

print(f".p4-frames-img {{")
print(f"    position: absolute;")
print(f"    left: {fx/ref_w*100:.2f}%;")
print(f"    top: {fy/ref_h*100:.2f}%;")
print(f"    width: {fw/ref_w*100:.2f}%;")
print(f"    height: {fh/ref_h*100:.2f}%;")
print(f"}}")

print(f".p4-text {{")
print(f"    position: absolute;")
print(f"    left: {tx/ref_w*100:.2f}%;")
print(f"    top: {ty/ref_h*100:.2f}%;")
print(f"    width: {tw/ref_w*100:.2f}%;")
print(f"    height: {th/ref_h*100:.2f}%;")
print(f"}}")

alpha = frames_img[:, :, 3]
_, holes = cv2.threshold(alpha, 10, 255, cv2.THRESH_BINARY_INV)
contours, _ = cv2.findContours(holes, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

i = 9
for contour in contours:
    area = cv2.contourArea(contour)
    if area > 10000:
        rect = cv2.minAreaRect(contour)
        cx, cy = rect[0]
        w, h = rect[1]
        angle = rect[2]
        
        if w < h:
            w, h = h, w
            angle += 90
            
        abs_cx = fx + cx
        abs_cy = fy + cy
        
        print(f"\n.photo-{i} {{")
        print(f"    left: {abs_cx/ref_w*100:.2f}%;")
        print(f"    top: {abs_cy/ref_h*100:.2f}%;")
        print(f"    width: {w/ref_w*100:.2f}%;")
        print(f"    height: {h/ref_h*100:.2f}%;")
        print(f"    transform: translate(-50%, -50%) rotate({angle:.2f}deg);")
        print(f"}}")
        i += 1
