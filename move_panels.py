#!/usr/bin/env python3
import re
import os

def move_panels_outside(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find export default function line
    export_match = re.search(r'^(export default function \w+\(\)\s*\{)', content, re.MULTILINE)
    if not export_match:
        print(f"ERROR: Could not find 'export default function' in {filepath}")
        return False

    export_line = export_match.group(0)
    export_start = export_match.start()

    # Find LeftPanel start - look for "const LeftPanel = React.memo"
    left_start_pattern = r'^\s*// .*LEFT.*\n\s*const LeftPanel = React\.memo\('
    left_match = re.search(left_start_pattern, content, re.MULTILINE)
    if not left_match:
        print(f"ERROR: Could not find LeftPanel in {filepath}")
        return False

    left_start = left_match.start()

    # Find RightPanel start
    right_start_pattern = r'^\s*// .*RIGHT.*\n\s*const RightPanel = React\.memo\('
    right_match = re.search(right_start_pattern, content, re.MULTILINE)

    # Extract LeftPanel (from its start to just before RightPanel or export)
    if right_match:
        right_start = right_match.start()
        left_panel_content = content[left_start:right_start]
        # Remove both panels from content
        content_without_panels = content[:left_start] + content[right_start:]
        # Now find where RightPanel ends - it should be before the return statement
        # Actually, after removing LeftPanel, RightPanel is now at left_start position
        # Let me re-find RightPanel in the new content
        right_match2 = re.search(right_start_pattern, content_without_panels, re.MULTILINE)
        if right_match2:
            # Find where RightPanel ends - look for the pattern that indicates end of component
            # It should be followed by the main component's return statement
            # Find: `  ))` followed by whitespace and then the component usage or return
            right_panel_body = content_without_panels[right_match2.start():]
            # Find the end of RightPanel - it ends with `  ))` before the main JSX
            # Look for the pattern that marks the end (either return statement or end of file)
            end_marker = re.search(r'^\s*return\s*\(\s*$', right_panel_body, re.MULTILINE)
            if end_marker:
                right_panel_full = right_panel_body[:end_marker.start()]
                # Remove RightPanel from content
                content_without_panels = content_without_panels[:right_match2.start()] + content_without_panels[right_match2.start() + len(right_panel_full):]
            else:
                # RightPanel might go to end of file or before a certain pattern
                # Look for the component usage: <LeftPanel or <RightPanel
                usage_match = re.search(r'^\s*<(Left|Right)Panel', right_panel_body, re.MULTILINE)
                if usage_match:
                    right_panel_full = right_panel_body[:usage_match.start()]
                    content_without_panels = content_without_panels[:right_match2.start()] + content_without_panels[right_match2.start() + len(right_panel_full):]
                else:
                    print(f"WARNING: Could not find end of RightPanel in {filepath}")
                    return False
    else:
        # Only LeftPanel exists (might be the case in Desktop file)
        left_panel_full = content[left_start:]
        content_without_panels = content[:left_start]
        right_panel_full = ""

    # Now we have:
    # - content_without_panels: the file content without the panel definitions
    # - left_panel_content: the LeftPanel definition
    # - right_panel_full: the RightPanel definition (may be empty)

    # Find where to insert (before export default)
    export_match2 = re.search(r'^(export default function \w+\(\)\s*\{)', content_without_panels, re.MULTILINE)
    if not export_match2:
        print(f"ERROR: Could not find export line after removal in {filepath}")
        return False

    # Build new content: panels + everything up to export + panels + rest
    new_content = left_panel_content + "\n" + right_panel_full + "\n\n" + content_without_panels

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"SUCCESS: Moved panels outside in {filepath}")
    return True

# Process both files
files = [
    r"D:\ipl-auction\src\components\AuctionRoomMobile.jsx",
    r"D:\ipl-auction\src\components\AuctionRoomDesktop.jsx"
]

for f in files:
    if os.path.exists(f):
        move_panels_outside(f)
    else:
        print(f"ERROR: File not found: {f}")
