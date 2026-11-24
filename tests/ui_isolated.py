"""UI-Smoketest in Chromium mit In-Memory-Datenbank, kein echter IndexedDB-Test."""
import asyncio
import json
import re
from pathlib import Path
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
html=re.sub(r'<script type="module" src="app.js"></script>','',html)
css=(ROOT/'styles.css').read_text()
html=html.replace('<link rel="stylesheet" href="styles.css">',f'<style>{css}</style>')
seed=json.loads((ROOT/'scentos_public_catalog.json').read_text())
stub='''
let LOCAL_STATE={catalog:[],profiles:[],collections:[],approvals:[],tests:[],wearLogs:[],settings:[]};
const FIELDS={catalog:'id',profiles:'id',collections:'key',approvals:'key',tests:'id',wearLogs:'id',settings:'key'};
async function dbOpen(){return {}};
async function getAll(store){return structuredClone(LOCAL_STATE[store])};
async function get(store,id){return structuredClone(LOCAL_STATE[store].find(x=>x[FIELDS[store]]===id))};
async function put(store,item){let n=LOCAL_STATE[store].findIndex(x=>x[FIELDS[store]]===item[FIELDS[store]]);if(n>=0)LOCAL_STATE[store][n]=structuredClone(item);else LOCAL_STATE[store].push(structuredClone(item))};
async function remove(store,id){LOCAL_STATE[store]=LOCAL_STATE[store].filter(x=>x[FIELDS[store]]!==id)};
async function readState(){return {...structuredClone(LOCAL_STATE),format:'scentos-local-v1'}};
async function seedIfEmpty(source){if(!LOCAL_STATE.profiles.length){LOCAL_STATE=migrateLegacy(source)}};
async function safeImport(source){return {added:{},skipped:{}}};
'''
# No imported db.js; use test double. The recommendation logic is the real production module.
parts=[]
for name in ['model.js','recommendation.js','weather.js','app.js']:
    s=(ROOT/name).read_text()
    s=re.sub(r'^import .*?;\n','',s,flags=re.M)
    s=re.sub(r'^export (?=(?:const|function|async function|class))','',s,flags=re.M)
    parts.append(s)
code=parts[0]+"\n"+parts[1]+"\n"+parts[2]+"\n"+stub+"\n"+parts[3]

async def main():
  async with async_playwright() as p:
    browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    context=await browser.new_context(viewport={'width':390,'height':850},service_workers='block')
    page=await context.new_page()
    errs=[]
    page.on('pageerror',lambda e:errs.append(str(e)))
    await page.set_content(html)
    await page.evaluate('(s)=>{ window.fetch=async()=>({ok:true,json:async()=>s}); if(!crypto.randomUUID) Object.defineProperty(crypto,"randomUUID",{value:()=>"test-"+Math.random().toString(16).slice(2)}); }',seed)
    await page.add_script_tag(content=code)
    await page.get_by_text('Meine Duftempfehlung').wait_for(timeout=10000)
    await page.get_by_role('button',name='Meine Top 3 berechnen').click()
    assert 'keine geeigneten düfte' in (await page.locator('#view').inner_text()).lower()
    await page.get_by_role('button',name='Meine Sammlung',exact=True).click()
    row=page.locator('article.item').filter(has_text='Fucking Fabulous').first
    await row.locator('.collection-form select[name="status"]').select_option('vorhanden')
    await row.get_by_role('button',name='Sammlung speichern').click()
    await page.get_by_role('button',name='Empfehlungen').click()
    await page.locator('#recommend-form select[name="occasion"]').select_option('konzert')
    await page.locator('#recommend-form select[name="weatherMode"]').select_option('manual')
    await page.locator('#recommend-form input[name="manualTemperature"]').fill('4')
    await page.get_by_role('button',name='Meine Top 3 berechnen').click()
    await page.locator('.rec-result').first.wait_for(timeout=10000)
    assert await page.locator('.rec-result').count()==1
    txt=await page.locator('.rec-result').first.inner_text()
    assert 'Fucking Fabulous' in txt
    await page.locator('.rec-result summary').click()
    assert 'Anlass' in await page.locator('.rec-factors').first.inner_text()
    # Use profile switch to verify no cross-profile recommendations.
    await page.get_by_role('button',name='Profil & Approver',exact=True).click()
    await page.locator('#new-profile-form input[name="name"]').fill('Testprofil 2')
    await page.locator('#new-profile-form select[name="approverMode"]').select_option('none')
    await page.get_by_role('button',name='Neues Profil erstellen').click()
    await page.get_by_role('button',name='Empfehlungen').click()
    await page.get_by_role('button',name='Meine Top 3 berechnen').click()
    assert 'keine geeigneten düfte' in (await page.locator('#view').inner_text()).lower()
    await page.screenshot(path=str(ROOT/'browser_isolated.png'),full_page=True)
    assert not errs,errs
    print('PASS: Chromium UI-Smoketest mit isolierter In-Memory-Datenbank, Top-3-Berechnung, Erklärung, Profiltrennung, keine JS-Fehler')
    await browser.close()

asyncio.run(main())
