import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
 const page=await browser.newPage({viewport:{width:1920,height:1080}});
 await page.route('**/*',r=>r.abort());
 page.on('pageerror',e=>console.log('PAGE ERROR:',e.message));
 await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="graph"></div></body></html>');
 await page.evaluate(()=>{window.urlParams={};window.mxLoadResources=false;window.mxLoadStylesheets=false;window.mxBasePath='';window.mxImageBasePath='';window.mxLanguage='en';window.mxDefaultLanguage='en';});
 await page.addScriptTag({path:'/tmp/juristic-drawio-app.min.js'});
 console.log(await page.evaluate(()=>({mxGraph:typeof mxGraph,mxCodec:typeof mxCodec,mxUtils:typeof mxUtils,Graph:typeof Graph,Editor:typeof Editor})));
} finally {await browser.close();}
