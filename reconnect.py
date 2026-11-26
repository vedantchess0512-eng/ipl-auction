#!/usr/bin/env python3
import re

def find_matching_paren(content, start):
    """Find the index of the matching closing ) for a ( at given start."""
    count = 1
    in_string = False
    string_char = None
    i = start + 1
    while i < len(content):
        c = content[i]
        if in_string:
            if c == string_char and content[i-1] != '\\':
                in_string = False
            i += 1
            continue
        if c in ('"', "'"):
            in_string = True
            string_char = c
        elif c == '(':
            count += 1
        elif c == ')':
            count -= 1
            if count == 0:
                return i
        i += 1
    return -1

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"Fixing {filepath}...")

    # Step 1: Find and remove orphaned props (outside)
    # LeftPanel props
    left_props_pattern = r'^\s*// .*LEFT.*\n\s*const LeftPanel = React\.memo\(\s*\(\s*\{[^}]*\}\s*\)\s*\n'
    left_props_match = re.search(left_props_pattern, content, re.MULTILINE)
    if left_props_match:
        print(f"  Found orphaned LeftPanel props at {left_props_match.start()}-{left_props_match.end()}")
        left_props = left_props_match.group(0)
        # Remove from content
        content_without_props = content[:left_props_match.start()] + content[left_props_match.end():]
    else:
        print("  No orphaned LeftPanel props found")
        content_without_props = content
        left_props = ""

    # RightPanel props
    right_props_pattern = r'^\s*// .*RIGHT.*\n\s*const RightPanel = React\.memo\(\s*\(\s*\{[^}]*\}\s*\)\s*\n'
    right_props_match = re.search(right_props_pattern, content_without_props, re.MULTILINE)
    if right_props_match:
        print(f"  Found orphaned RightPanel props at {right_props_match.start()}-{right_props_match.end()}")
        right_props = right_props_match.group(0)
        content_without_both = content_without_props[:right_props_match.start()] + content_without_props[right_props_match.end():]
    else:
        print("  No orphaned RightPanel props found")
        content_without_both = content_without_props
        right_props = ""

    # Step 2: Find the arrow functions and JSX bodies inside
    # Find "=> (" pattern
    arrow_pattern = r'^\s*=>\s*\(\s*$'

    # Find all => ( in the content
    pos = 0
    arrow_positions = []
    while True:
        p = content_without_both.find('=> (', pos)
        if p == -1:
            break
        arrow_positions.append(p)
        pos = p + 1

    print(f"  Found {len(arrow_positions)} '=> (' positions: {arrow_positions}")

    # For each => (, find the matching ))
    jsx_bodies = []
    for p in arrow_positions:
        # Find the ( that starts the JSX (the ( in => ()
        paren_open = content_without_both.find('(', p)
        if paren_open == -1:
            continue
        # Find matching )
        paren_close = find_matching_paren(content_without_both, paren_open)
        if paren_close == -1:
            print(f"  WARNING: Could not find matching ) for => ( at {p}")
            continue
        # Include ))
        end = paren_close + 1
        if end < len(content_without_both) and content_without_both[end] == ')':
            end += 1
        jsx_body = content_without_both[p:end]
        jsx_bodies.append((p, end, jsx_body))
        print(f"  Found JSX body at {p}-{end} (len={len(jsx_body)})")

    # Step 3: Build complete components
    # The first JSX body belongs to LeftPanel, the second to RightPanel (if exists)
    components = ""

    # Process LeftPanel
    if left_props and len(jsx_bodies) >= 1:
        # Clean up left_props - remove trailing ) and whitespace
        left_props_clean = left_props.rstrip()
        if left_props_clean.endswith(')'):
            left_props_clean = left_props_clean[:-1]  # Remove trailing )

        # Get the first JSX body
        jsx1_start, jsx1_end, jsx1_body = jsx_bodies[0]

        # Combine: props + ) => ( + jsx_body
        left_full = left_props_clean + ') => (\n' + jsx1_body + '\n'
        components += left_full
        print(f"  Built LeftPanel (len={len(left_full)})")

    # Process RightPanel
    if right_props and len(jsx_bodies) >= 2:
        right_props_clean = right_props.rstrip()
        if right_props_clean.endswith(')'):
            right_props_clean = right_props_clean[:-1]

        jsx2_start, jsx2_end, jsx2_body = jsx_bodies[1]

        right_full = right_props_clean + ') => (\n' + jsx2_body + '\n'
        components += right_full
        print(f"  Built RightPanel (len={len(right_full)})")

    # Step 4: Remove JSX bodies from content
    # Sort by position (descending)
    sorted_bodies = sorted(jsx_bodies, key=lambda x: x[0], reverse=True)

    final_content = content_without_both
    for start, end, body in sorted_bodies:
        final_content = final_content[:start] + final_content[end:]

    # Step 5: Insert components before export default
    export_pos = final_content.find('export default function ')
    if export_pos == -1:
        print("  ERROR: Could not find export default function")
        return False

    final_content = final_content[:export_pos] + components + '\n' + final_content[export_pos:]

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(final_content)

    print(f"  SUCCESS: Fixed {filepath}")
    return True

# Process both files
files = [
    r"D:\ipl-auction\src\components\AuctionRoomMobile.jsx",
    r"D:\ipl-auction\src\components\AuctionRoomDesktop.jsx"
]

for f in files:
    fix_file(f)
