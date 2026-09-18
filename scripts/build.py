from pathlib import Path
import zipfile
import base64

root=Path(__file__).resolve().parent.parent
src=root/'app'
out=root/'dist'
out.mkdir(exist_ok=True)
html=(src/'index.html').read_text(encoding='utf-8')
for css in ('style.css','blocks.css','duel.css'):
    html=html.replace(f'<link rel="stylesheet" href="{css}">','<style>\n'+(src/css).read_text(encoding='utf-8')+'\n</style>')
def inline_js(name: str) -> str:
    """Read a local script and make Blockly's small media references self-contained.

    Blockly's default bundle points at static.blockly.com for sprites and foldout
    icons.  Replacing those filename literals with data URLs keeps the classroom
    file usable from a USB drive or an air-gapped machine.  Audio remains disabled
    by the app, so the audio files do not need to be embedded.
    """
    text = (src/name).read_text(encoding='utf-8')
    if name == 'blockly.min.js':
        text = text.replace('https://static.blockly.com/media/', '').replace('var Xa="media/";', 'var Xa="";')
        for media_name, mime in {
            'sprites.svg': 'image/svg+xml',
            'foldout-icon.svg': 'image/svg+xml',
            'dropdown-arrow.svg': 'image/svg+xml',
            'delete-icon.svg': 'image/svg+xml',
            'resize-handle.svg': 'image/svg+xml',
            'handclosed.cur': 'application/octet-stream',
            'handdelete.cur': 'application/octet-stream',
            'handopen.cur': 'application/octet-stream',
        }.items():
            media_file = src/'media'/media_name
            encoded = base64.b64encode(media_file.read_bytes()).decode('ascii')
            data_url = f'data:{mime};base64,{encoded}'
            # CSS uses <<<PATH>>>/sprites.svg while SVG image hrefs use
            # pathToMedia + filename; replacing both literal forms is safe.
            text = text.replace(f'<<<PATH>>>/{media_name}', data_url)
            text = text.replace(media_name, data_url)
    return text.replace('</script','<\\/script')

for js in ('blockly.min.js','zh-hans.js','engine.js','replay.js','block-adapter.js','blockly-adapter.js','angle-lab.js','duel-model.js','duel.js','app.js'):
    html=html.replace(f'<script src="{js}"></script>','<script>\n'+inline_js(js)+'\n</script>')
target=out/'角度探险家.html'
notice = src/'THIRD-PARTY-NOTICES.txt'
if notice.exists():
    html = html.replace('</html>', '\n<!--\n'+notice.read_text(encoding='utf-8').replace('-->', '-- >')+'\n-->\n</html>')
target.write_text(html,encoding='utf-8')
# GitHub Pages serves the same self-contained build from the repository root.
(root/'index.html').write_text(html,encoding='utf-8')
with zipfile.ZipFile(out/'角度探险家-离线课堂.zip','w',zipfile.ZIP_DEFLATED) as z:
    z.write(target,target.name)
    handbook=root/'docs'/'TEACHER_GUIDE.md'
    if handbook.exists():
        z.write(handbook,'教师使用指南.md')
    usage=root/'docs'/'使用说明.md'
    if usage.exists():
        z.write(usage,'使用说明.md')
    # Keep the open-source notice next to the single-file app for school IT
    # inventories and redistribution of the offline package.
    if notice.exists():
        z.write(notice, 'THIRD-PARTY-NOTICES.txt')
print(f'Built {target.name}: {target.stat().st_size:,} bytes')


