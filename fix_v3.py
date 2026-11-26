#!/usr/bin/env python3
import re

def find_matching_paren(content, start):
    """Find matching ) for ( at position start."""
    count = 1
    in_str = False
    str_char = None
    i = start + 1
    while i < len(content):
        c = content[i]
        if in_str:
            if c == str_char and content[i-1] != '\\':
                in_str = False
            i += 1
            continue
        if c in ('"', "'"):
            in_str = True
            str_char = c
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

    # Step 1: Find orphaned props outside (before export default)
    export_match = re.search(r'^(export default function \w+\(\)\s*\{)', content, re.MULTILINE)
    if not export_match:
        print("  ERROR: No export default found")
        return False

    export_start = export_match.start()
    export_line = export_match.group(0)

    # Find orphaned LeftPanel props (const LeftPanel = React.memo(({...}))
    orphaned_left = re.search(r'^\s*const LeftPanel = React\.memo\(\s*\(\s*\{', content[:export_start], re.MULTILINE)
    orphaned_right = re.search(r'^\s*const RightPanel = React\.memo\(\s*\(\s*\{', content[:export_start], re.MULTILINE)

    left_props = ""
    right_props = ""
    content_after_removal = content

    if orphaned_left:
        # Find the end of this orphaned definition
        start_pos = orphaned_left.start()
        # Find the closing ) for React.memo(
        memo_open = content.find('React.memo(', start_pos)
        first_paren = content.find('(', memo_open + len('React.memo(') - 1)
        end_paren = find_matching_paren(content, first_paren)

        if end_paren > -1:
            left_props = content[start_pos:end_paren + 1]
            # Remove from content
            content_after_removal = content[:start_pos] + content[end_paren + 1:]
            print(f"  Found orphaned LeftPanel props at {start_pos}-{end_paren}")
        else:
            print("  WARNING: Found LeftPanel but couldn't find end")

    if orphaned_right:
        # Re-find in the new content
        orphaned_right2 = re.search(r'^\s*const RightPanel = React\.memo\(\s*\(\s*\{', content_after_removal[:export_start], re.MULTILINE)
        if orphaned_right2:
            start_pos = orphaned_right2.start()
            memo_open = content_after_removal.find('React.memo(', start_pos)
            first_paren = content_after_removal.find('(', memo_open + len('React.memo(') - 1)
            end_paren = find_matching_paren(content_after_removal, first_paren)

            if end_paren > -1:
                right_props = content_after_removal[start_pos:end_paren + 1]
                content_after_removal = content_after_removal[:start_pos] + content_after_removal[end_paren + 1:]
                print(f"  Found orphaned RightPanel props at {start_pos}-{end_paren}")

    # Step 2: Find JSX body inside function (=> ( ... ))
    # Look for "=> (" pattern in the content after removal
    arrow_pattern = r'^\s*=>\s*\('
    arrow_match = re.search(arrow_pattern, content_after_removal, re.MULTILINE)

    if not arrow_match:
        print("  ERROR: Could not find '=> (' for JSX body")
        return False

    # We need to find which component this belongs to
    # It should be preceded by the orphaned props
    # The structure is: => ( <jsx>...</jsx> ))

    # Find the matching )) for the component
    arrow_start = arrow_match.start()

    # Find all )) in the content after arrow_start
    search_pos = arrow_start
    jsx_end = -1
    while True:
        close_pos = content_after_removal.find('))', search_pos)
        if close_pos == -1:
            break
        # Check if this is a valid end by checking parentheses balance
        test = content_after_removal[arrow_start:close_pos + 2]
        if test.count('(') == test.count(')'):
            jsx_end = close_pos + 2
            break
        search_pos = close_pos + 1

    if jsx_end == -1:
        print("  ERROR: Could not find end of JSX body")
        return False

    jsx_body = content_after_removal[arrow_start:jsx_end]
    print(f"  Found JSX body at {arrow_start}-{jsx_end}")

    # Remove JSX body from content
    content_cleaned = content_after_removal[:arrow_start] + content_after_removal[jsx_end:]

    # Step 3: Reconstruct full component
    # The orphaned props ends with something like: })\n or })
    # We need: const LeftPanel = React.memo(({ props... }) => ( <jsx>... ))

    # Clean up left_props - remove trailing whitespace/newlines
    left_props = left_props.rstrip()

    # The left_props should end with something like `})` or `})\n`
    # We need to add `) => (` before the JSX body
    full_left = left_props
    if not full_left.endswith(')'):
        # The props part is just `{ props... }` without the closing )
        # We need to add `) => (`
        if full_left.endswith('}'):
            full_left = full_left.rstrip('}') + '}) => ('
        else:
            full_left += ') => ('
    else:
        # Already has ), just add ` => (`
        full_left = full_left.rstrip(')') + ') => ('

    full_left += '\n' + jsx_body

    # Step 4: Do the same for RightPanel if it exists
    # Actually, we might have multiple => ( in the file (one for LeftPanel, one for RightPanel)
    # Let me check if there's another => ( after the first one

    arrow_match2 = re.search(arrow_pattern, content_cleaned, re.MULTILINE)
    full_right = ""

    if arrow_match2:
        arrow_start2 = arrow_match2.start()
        search_pos = arrow_start2
        jsx_end2 = -1
        while True:
            close_pos = content_cleaned.find('))', search_pos)
            if close_pos == -1:
                break
            test = content_cleaned[arrow_start2:close_pos + 2]
            if test.count('(') == test.count(')'):
                jsx_end2 = close_pos + 2
                break
            search_pos = close_pos + 1

        if jsx_end2 > -1:
            jsx_body2 = content_cleaned[arrow_start2:jsx_end2]
            content_cleaned = content_cleaned[:arrow_start2] + content_cleaned[jsx_end2:]

            right_props_clean = right_props.rstrip()
            full_right = right_props_clean
            if not full_right.endswith(')'):
                if full_right.endswith('}'):
                    full_right = full_right.rstrip('}') + '}) => ('
                else:
                    full_right += ') => ('
            else:
                full_right = full_right.rstrip(')') + ') => ('

            full_right += '\n' + jsx_body2

    # Step 5: Build final content with components before export
    # Find export line in cleaned content
    export_match2 = re.search(r'^(export default function \w+\(\)\s*\{)', content_cleaned, re.MULTILINE)
    if not export_match2:
        print("  ERROR: Export line not found after cleaning")
        return False

    insert_pos = export_match2.start()

    final_content = ""
    if full_left:
        final_content += full_left + "\n\n"
    if full_right:
        final_content += full_right + "\n\n"

    final_content += content_cleaned

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
