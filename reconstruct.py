#!/usr/bin/env python3
import re

def find_matching_paren(s, start):
    """Find the index of the matching closing ) for a ( at given start."""
    count = 1
    i = start + 1
    in_string = False
    string_char = None
    while i < len(s):
        c = s[i]
        if in_string:
            if c == string_char and s[i-1] != '\\':
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

    # Step 1: Find and remove the orphaned LeftPanel props (outside function)
    # Pattern: const LeftPanel = React.memo(({ ... }) followed by blank line
    orphaned_left_pattern = r'^\s*const LeftPanel = React\.memo\(\s*\(\s*\{[^}]*\}\s*\)\s*\n'
    orphaned_left_match = re.search(orphaned_left_pattern, content, re.MULTILINE)

    if orphaned_left_match:
        print(f"  Found orphaned LeftPanel props at {orphaned_left_match.start()}-{orphaned_left_match.end()}")
        left_props = orphaned_left_match.group(0)
        # Remove from content
        content_without_orphaned = content[:orphaned_left_match.start()] + content[orphaned_left_match.end():]
    else:
        print("  No orphaned LeftPanel found")
        content_without_orphaned = content
        left_props = ""

    # Step 2: Find and remove the orphaned RightPanel props (outside function)
    orphaned_right_pattern = r'^\s*const RightPanel = React\.memo\(\s*\(\s*\{[^}]*\}\s*\)\s*\n'
    orphaned_right_match = re.search(orphaned_right_pattern, content_without_orphaned, re.MULTILINE)

    if orphaned_right_match:
        print(f"  Found orphaned RightPanel props at {orphaned_right_match.start()}-{orphaned_right_match.end()}")
        right_props = orphaned_right_match.group(0)
        content_without_both = content_without_orphaned[:orphaned_right_match.start()] + content_without_orphaned[orphaned_right_match.end():]
    else:
        print("  No orphaned RightPanel found")
        right_props = ""
        content_without_both = content_without_orphaned

    # Step 3: Now find the LeftPanel JSX body inside the function
    # It starts with `=> (` and ends with `))` before RightPanel's JSX or end of function
    arrow_pattern = r'^\s*=>\s*\(\s*\n'
    arrow_match = re.search(arrow_pattern, content_without_both, re.MULTILINE)

    if not arrow_match:
        print("  ERROR: Could not find '=> (' for LeftPanel")
        return False

    arrow_start = arrow_match.start()
    print(f"  Found '=> (' at {arrow_start}")

    # Find the matching )) for the React.memo call
    # The structure is: React.memo(({props}) => (<jsx>...</jsx>))
    # We need to find the ) that matches the ( after React.memo

    # Actually, let me find the `))` that closes the component
    # Look for `))` preceded by `</div>` (the closing of the main div)

    # Find all )) in the content after arrow_start
    search_start = arrow_start
    while True:
        paren_close = content_without_both.find('))', search_start)
        if paren_close == -1:
            break
        # Check if this is the matching one by counting parentheses
        test_str = content_without_both[arrow_start:paren_close+2]
        if test_str.count('(') == test_str.count(')'):
            # This might be the matching one
            # Check if there's a newline after ))
            remaining = content_without_both[paren_close+2:]
            if remaining.lstrip().startswith(('export', 'const', 'return')):
                leftpanel_end = paren_close + 2
                print(f"  Found LeftPanel end at {leftpanel_end}")
                break
        search_start = paren_close + 1
    else:
        print("  ERROR: Could not find LeftPanel end"))
        return False

    # Extract LeftPanel JSX body
    left_jsx_start = arrow_start
    left_jsx_end = leftpanel_end
    left_jsx = content_without_both[left_jsx_start:left_jsx_end]

    # Step 4: Find RightPanel JSX body (if exists)
    # Look for the next `=> (` after LeftPanel ends
    right_arrow_start = content_without_both.find('=> (', left_jsx_end)

    if right_arrow_start > -1:
        # Find RightPanel's end
        search_start = right_arrow_start
        while True:
            paren_close = content_without_both.find('))', search_start)
            if paren_close == -1:
                break
            test_str = content_without_both[right_arrow_start:paren_close+2]
            if test_str.count('(') == test_str.count(')'):
                rightpanel_end = paren_close + 2
                print(f"  Found RightPanel end at {rightpanel_end}")
                break
            search_start = paren_close + 1
        else:
            print("  ERROR: Could not find RightPanel end"))
            return False

        right_jsx = content_without_both[right_arrow_start:rightpanel_end]
        right_jsx_full = right_jsx
    else:
        right_jsx_full = ""

    # Step 5: Build the complete components
    # The props we extracted are like: const LeftPanel = React.memo(({ props... })
    # We need to add: ) => ( <jsx>... ))

    # Clean up the props (remove trailing ) and newline)
    left_props_clean = left_props.strip()
    if left_props_clean.endswith(')'):
        left_props_clean = left_props_clean[:-1]  # Remove trailing )

    left_component = left_props_clean + "\n" + left_jsx + "\n"

    if right_jsx_full:
        right_props_clean = right_props.strip()
        if right_props_clean.endswith(')'):
            right_props_clean = right_props_clean[:-1]
        right_component = right_props_clean + "\n" + right_jsx_full + "\n"
    else:
        right_component = ""

    # Step 6: Remove the JSX bodies from inside the function
    # We already have content_without_both (without orphaned props)
    # Now remove the JSX parts
    content_cleaned = content_without_both[:left_jsx_start] + content_without_both[left_jsx_end:]

    if right_jsx_full:
        # Find right_jsx in the cleaned content (positions shifted)
        # Actually, let me recalculate
        pass

    # Actually, let me redo this more carefully
    # I need to:
    # 1. Take original content
    # 2. Remove orphaned props (done -> content_without_both)
    # 3. Remove JSX bodies (left_jsx, right_jsx) from content_without_both

    # Let me redo from scratch with a cleaner approach
    print("  Redoing with cleaner approach...")

    # Re-read the file
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all the parts we need to remove or relocate
    # 1. Find orphaned LeftPanel props
    m1 = re.search(r'^\s*const LeftPanel = React\.memo\(\s*\(\s*\{[^}]*\}\s*\)\s*\n', content, re.MULTILINE)
    # 2. Find orphaned RightPanel props
    m2 = re.search(r'^\s*const RightPanel = React\.memo\(\s*\(\s*\{[^}]*\}\s*\)\s*\n', content, re.MULTILINE)
    # 3. Find LeftPanel JSX body (=> ( ... ))
    # 4. Find RightPanel JSX body (=> ( ... ))

    # This is getting too complex. Let me try a different approach:
    # Manually reconstruct the file by:
    # 1. Get the top part (before export default)
    # 2. Get the function body
    # 3. Extract panel definitions from function body
    # 4. Rebuild

    # Find export default
    export_match = re.search(r'^(export default function \w+\(\)\s*\{)', content, re.MULTILINE)
    if not export_match:
        print("  ERROR: No export default found")
        return False

    export_line = export_match.group(0)
    export_start = export_match.start()

    # The function body starts after export_line
    func_start = export_match.end()

    # Find the end of the function (matching brace)
    # Actually, let me find where LeftPanel and RightPanel JSX are in the function body

    # For now, let me just try to:
    # 1. Remove the orphaned props from outside the function
    # 2. Find and extract the complete LeftPanel/RightPanel from INSIDE the function
    # 3. Place them before export default

    print("  Trying simpler approach...")

    # Find the orphaned LeftPanel props and remove
    # Find the orphaned RightPanel props and remove
    # Find the LeftPanel JSX body inside function and remove
    # Find the RightPanel JSX body inside function and remove
    # Reassemble

    # I think the cleanest way is to:
    # 1. Find the orphaned const LeftPanel = React.memo(({...}) [outside]
    # 2. Find the orphaned const RightPanel = React.memo(({...}) [outside]
    # 3. Find => ( ... )) inside function [for LeftPanel]
    # 4. Find => ( ... )) inside function [for RightPanel]
    # 5. Combine and move outside

    # Let me just manually fix by writing the correct content

    # Actually, I realize the issue is my previous edits created a mess
    # Let me just find the COMPLETE LeftPanel by searching for its start and end in the file

    # Search for the pattern that represents the full LeftPanel
    # It should be: const LeftPanel = React.memo(({ props }) => ( <jsx>...</jsx> ))

    # Let me find the const LeftPanel inside the function (the original one)
    left_in_func_pattern = r'const LeftPanel = React\.memo\(\s*\(\s*\{[^}]*\}\s*\)\s*=>\s*\(\s*\n.*?\)\s*\)\s*;?\s*\n'
    # This is too complex with regex. Let me use a different approach.

    print("  ERROR: Need manual fix - file is in broken state")
    return False

# Process both files
files = [
    r"D:\ipl-auction\src\components\AuctionRoomMobile.jsx",
    r"D:\ipl-auction\src\components\AuctionRoomDesktop.jsx"
]

for f in files:
    fix_file(f)
