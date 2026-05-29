module.exports=[16426,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"warnOnce",{enumerable:!0,get:function(){return d}});let d=a=>{}},29945,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={getDeploymentId:function(){return f},getDeploymentIdQueryOrEmptyString:function(){return g}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});function f(){return!1}function g(){return""}},1359,(a,b,c)=>{"use strict";function d({widthInt:a,heightInt:b,blurWidth:c,blurHeight:d,blurDataURL:e,objectFit:f}){let g=c?40*c:a,h=d?40*d:b,i=g&&h?`viewBox='0 0 ${g} ${h}'`:"";return`%3Csvg xmlns='http://www.w3.org/2000/svg' ${i}%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3CfeColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1' result='s'/%3E%3CfeFlood x='0' y='0' width='100%25' height='100%25'/%3E%3CfeComposite operator='out' in='s'/%3E%3CfeComposite in2='SourceGraphic'/%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3C/filter%3E%3Cimage width='100%25' height='100%25' x='0' y='0' preserveAspectRatio='${i?"none":"contain"===f?"xMidYMid":"cover"===f?"xMidYMid slice":"none"}' style='filter: url(%23b);' href='${e}'/%3E%3C/svg%3E`}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"getImageBlurSvg",{enumerable:!0,get:function(){return d}})},53549,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={VALID_LOADERS:function(){return f},imageConfigDefault:function(){return g}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f=["default","imgix","cloudinary","akamai","custom"],g={deviceSizes:[640,750,828,1080,1200,1920,2048,3840],imageSizes:[32,48,64,96,128,256,384],path:"/_next/image",loader:"default",loaderFile:"",domains:[],disableStaticImages:!1,minimumCacheTTL:14400,formats:["image/webp"],maximumRedirects:3,maximumResponseBody:5e7,dangerouslyAllowLocalIP:!1,dangerouslyAllowSVG:!1,contentSecurityPolicy:"script-src 'none'; frame-src 'none'; sandbox;",contentDispositionType:"attachment",localPatterns:void 0,remotePatterns:[],qualities:[75],unoptimized:!1}},87713,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"getImgProps",{enumerable:!0,get:function(){return j}}),a.r(16426);let d=a.r(29945),e=a.r(1359),f=a.r(53549),g=["-moz-initial","fill","none","scale-down",void 0];function h(a){return void 0!==a.default}function i(a){return void 0===a?a:"number"==typeof a?Number.isFinite(a)?a:NaN:"string"==typeof a&&/^[0-9]+$/.test(a)?parseInt(a,10):NaN}function j({src:a,sizes:b,unoptimized:c=!1,priority:j=!1,preload:k=!1,loading:l,className:m,quality:n,width:o,height:p,fill:q=!1,style:r,overrideSrc:s,onLoad:t,onLoadingComplete:u,placeholder:v="empty",blurDataURL:w,fetchPriority:x,decoding:y="async",layout:z,objectFit:A,objectPosition:B,lazyBoundary:C,lazyRoot:D,...E},F){var G;let H,I,J,{imgConf:K,showAltText:L,blurComplete:M,defaultLoader:N}=F,O=K||f.imageConfigDefault;if("allSizes"in O)H=O;else{let a=[...O.deviceSizes,...O.imageSizes].sort((a,b)=>a-b),b=O.deviceSizes.sort((a,b)=>a-b),c=O.qualities?.sort((a,b)=>a-b);H={...O,allSizes:a,deviceSizes:b,qualities:c}}if(void 0===N)throw Object.defineProperty(Error("images.loaderFile detected but the file is missing default export.\nRead more: https://nextjs.org/docs/messages/invalid-images-config"),"__NEXT_ERROR_CODE",{value:"E163",enumerable:!1,configurable:!0});let P=E.loader||N;delete E.loader,delete E.srcSet;let Q="__next_img_default"in P;if(Q){if("custom"===H.loader)throw Object.defineProperty(Error(`Image with src "${a}" is missing "loader" prop.
Read more: https://nextjs.org/docs/messages/next-image-missing-loader`),"__NEXT_ERROR_CODE",{value:"E252",enumerable:!1,configurable:!0})}else{let a=P;P=b=>{let{config:c,...d}=b;return a(d)}}if(z){"fill"===z&&(q=!0);let a={intrinsic:{maxWidth:"100%",height:"auto"},responsive:{width:"100%",height:"auto"}}[z];a&&(r={...r,...a});let c={responsive:"100vw",fill:"100vw"}[z];c&&!b&&(b=c)}let R="",S=i(o),T=i(p);if((G=a)&&"object"==typeof G&&(h(G)||void 0!==G.src)){let b=h(a)?a.default:a;if(!b.src)throw Object.defineProperty(Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include src. Received ${JSON.stringify(b)}`),"__NEXT_ERROR_CODE",{value:"E460",enumerable:!1,configurable:!0});if(!b.height||!b.width)throw Object.defineProperty(Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include height and width. Received ${JSON.stringify(b)}`),"__NEXT_ERROR_CODE",{value:"E48",enumerable:!1,configurable:!0});if(I=b.blurWidth,J=b.blurHeight,w=w||b.blurDataURL,R=b.src,!q)if(S||T){if(S&&!T){let a=S/b.width;T=Math.round(b.height*a)}else if(!S&&T){let a=T/b.height;S=Math.round(b.width*a)}}else S=b.width,T=b.height}let U=!j&&!k&&("lazy"===l||void 0===l);(!(a="string"==typeof a?a:R)||a.startsWith("data:")||a.startsWith("blob:"))&&(c=!0,U=!1),H.unoptimized&&(c=!0),Q&&!H.dangerouslyAllowSVG&&a.split("?",1)[0].endsWith(".svg")&&(c=!0);let V=i(n),W=Object.assign(q?{position:"absolute",height:"100%",width:"100%",left:0,top:0,right:0,bottom:0,objectFit:A,objectPosition:B}:{},L?{}:{color:"transparent"},r),X=M||"empty"===v?null:"blur"===v?`url("data:image/svg+xml;charset=utf-8,${(0,e.getImageBlurSvg)({widthInt:S,heightInt:T,blurWidth:I,blurHeight:J,blurDataURL:w||"",objectFit:W.objectFit})}")`:`url("${v}")`,Y=g.includes(W.objectFit)?"fill"===W.objectFit?"100% 100%":"cover":W.objectFit,Z=X?{backgroundSize:Y,backgroundPosition:W.objectPosition||"50% 50%",backgroundRepeat:"no-repeat",backgroundImage:X}:{},$=function({config:a,src:b,unoptimized:c,width:e,quality:f,sizes:g,loader:h}){if(c){let a=(0,d.getDeploymentId)();if(b.startsWith("/")&&!b.startsWith("//")&&a){let c=b.includes("?")?"&":"?";b=`${b}${c}dpl=${a}`}return{src:b,srcSet:void 0,sizes:void 0}}let{widths:i,kind:j}=function({deviceSizes:a,allSizes:b},c,d){if(d){let c=/(^|\s)(1?\d?\d)vw/g,e=[];for(let a;a=c.exec(d);)e.push(parseInt(a[2]));if(e.length){let c=.01*Math.min(...e);return{widths:b.filter(b=>b>=a[0]*c),kind:"w"}}return{widths:b,kind:"w"}}return"number"!=typeof c?{widths:a,kind:"w"}:{widths:[...new Set([c,2*c].map(a=>b.find(b=>b>=a)||b[b.length-1]))],kind:"x"}}(a,e,g),k=i.length-1;return{sizes:g||"w"!==j?g:"100vw",srcSet:i.map((c,d)=>`${h({config:a,src:b,quality:f,width:c})} ${"w"===j?c:d+1}${j}`).join(", "),src:h({config:a,src:b,quality:f,width:i[k]})}}({config:H,src:a,unoptimized:c,width:S,quality:V,sizes:b,loader:P}),_=U?"lazy":l;return{props:{...E,loading:_,fetchPriority:x,width:S,height:T,decoding:y,className:m,style:{...W,...Z},sizes:$.sizes,srcSet:$.srcSet,src:s||$.src},meta:{unoptimized:c,preload:k||j,placeholder:v,fill:q}}}},42377,(a,b,c)=>{let{createClientModuleProxy:d}=a.r(11857);a.n(d("[project]/node_modules/next/dist/client/image-component.js <module evaluation>"))},43489,(a,b,c)=>{let{createClientModuleProxy:d}=a.r(11857);a.n(d("[project]/node_modules/next/dist/client/image-component.js"))},18409,a=>{"use strict";a.i(42377);var b=a.i(43489);a.n(b)},53200,(a,b,c)=>{"use strict";function d(a,b){let c=a||75;return b?.qualities?.length?b.qualities.reduce((a,b)=>Math.abs(b-c)<Math.abs(a-c)?b:a,0):c}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"findClosestQuality",{enumerable:!0,get:function(){return d}})},37763,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"default",{enumerable:!0,get:function(){return g}});let d=a.r(53200),e=a.r(29945);function f({config:a,src:b,width:c,quality:f}){if(b.startsWith("/")&&b.includes("?")&&a.localPatterns?.length===1&&"**"===a.localPatterns[0].pathname&&""===a.localPatterns[0].search)throw Object.defineProperty(Error(`Image with src "${b}" is using a query string which is not configured in images.localPatterns.
Read more: https://nextjs.org/docs/messages/next-image-unconfigured-localpatterns`),"__NEXT_ERROR_CODE",{value:"E871",enumerable:!1,configurable:!0});let g=(0,d.findClosestQuality)(f,a),h=(0,e.getDeploymentId)();return`${a.path}?url=${encodeURIComponent(b)}&w=${c}&q=${g}${b.startsWith("/")&&h?`&dpl=${h}`:""}`}f.__next_img_default=!0;let g=f},50858,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={default:function(){return k},getImageProps:function(){return j}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f=a.r(71029),g=a.r(87713),h=a.r(18409),i=f._(a.r(37763));function j(a){let{props:b}=(0,g.getImgProps)(a,{defaultLoader:i.default,imgConf:{deviceSizes:[640,750,828,1080,1200,1920,2048,3840],imageSizes:[32,48,64,96,128,256,384],qualities:[75],path:"/_next/image",loader:"default",dangerouslyAllowSVG:!1,unoptimized:!0}});for(let[a,c]of Object.entries(b))void 0===c&&delete b[a];return{props:b}}let k=h.Image},3236,(a,b,c)=>{b.exports=a.r(50858)},58094,a=>{"use strict";var b=a.i(7997),c=a.i(3236);a.i(70396);var d=a.i(73727),e=a.i(9366);function f(a){return`Rp ${Number(a||0).toLocaleString("id-ID")}`}function g(a){return new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"long",year:"numeric"}).format(new Date(a))}function h({receipt:a,items:d,label:e,printedAt:h}){let j,k,l,m=Number(a.total||0),n=m>0,o=a.nama_lengkap||"________________",p=a.penerima_nama||"Bendahara";return(0,b.jsxs)("section",{className:"receipt-copy",children:[n?(0,b.jsx)("div",{className:"paid-stamp",children:"LUNAS"}):null,(0,b.jsxs)("header",{className:"receipt-header",children:[(0,b.jsx)(c.default,{src:"/logo.png",width:78,height:78,alt:"Logo Pesantren Sukahideng",priority:!0}),(0,b.jsxs)("div",{className:"school-heading",children:[(0,b.jsx)("h1",{children:"KUITANSI PEMBAYARAN"}),(0,b.jsx)("h2",{children:"PONDOK PESANTREN SUKAHIDENG"}),(0,b.jsx)("p",{children:"Desa Sukarapih Kec. Sukarame Kabupaten Tasikmalaya Jawa Barat 46461"})]})]}),(0,b.jsx)("div",{className:"header-rule"}),(0,b.jsx)("div",{className:"copy-label",children:e}),(0,b.jsxs)("section",{className:"intro-grid",children:[(0,b.jsxs)("div",{className:"student-info",children:[(0,b.jsx)(i,{label:"Nama Santri",value:o,strong:!0}),(0,b.jsx)(i,{label:"NIS",value:a.nis||"-"}),(0,b.jsx)(i,{label:"Kelas",value:a.sekolah||"-"}),(0,b.jsx)(i,{label:"Asrama",value:`${a.asrama||"-"} / ${a.kamar||"-"}`})]}),(0,b.jsxs)("div",{className:"payment-title",children:[(0,b.jsx)("h3",{children:"BUKTI PEMBAYARAN"}),(0,b.jsxs)("p",{children:["Pembayaran PSB - Tahun Tagihan ",a.tahun_tagihan||"-"]})]}),(0,b.jsxs)("div",{className:"receipt-info",children:[(0,b.jsx)(i,{label:"No. Bukti",value:a.receipt_no,strong:!0}),(0,b.jsx)(i,{label:"Tanggal",value:g(a.created_at)}),(0,b.jsx)(i,{label:"Metode",value:"Tunai"}),(0,b.jsx)(i,{label:"Petugas",value:p})]})]}),(0,b.jsxs)("div",{className:"terbilang",children:[(0,b.jsx)("span",{children:"Terbilang:"}),(0,b.jsx)("strong",{children:(j=Math.floor(Math.abs(Number(m||0))),k=["","Satu","Dua","Tiga","Empat","Lima","Enam","Tujuh","Delapan","Sembilan","Sepuluh","Sebelas"],l=a=>a<12?k[a]:a<20?`${l(a-10)} Belas`:a<100?`${l(Math.floor(a/10))} Puluh ${l(a%10)}`.trim():a<200?`Seratus ${l(a-100)}`.trim():a<1e3?`${l(Math.floor(a/100))} Ratus ${l(a%100)}`.trim():a<2e3?`Seribu ${l(a-1e3)}`.trim():a<1e6?`${l(Math.floor(a/1e3))} Ribu ${l(a%1e3)}`.trim():a<1e9?`${l(Math.floor(a/1e6))} Juta ${l(a%1e6)}`.trim():`${l(Math.floor(a/1e9))} Miliar ${l(a%1e9)}`.trim(),`${l(j).replace(/\s+/g," ")} Rupiah`)})]}),(0,b.jsxs)("table",{className:"main-table",children:[(0,b.jsx)("thead",{children:(0,b.jsxs)("tr",{children:[(0,b.jsx)("th",{className:"no-col",children:"No."}),(0,b.jsx)("th",{children:"Uraian Pembayaran"}),(0,b.jsx)("th",{className:"amount-col",children:"Jumlah (Rp)"})]})}),(0,b.jsx)("tbody",{children:d.map((a,c)=>{var d;return(0,b.jsxs)("tr",{children:[(0,b.jsx)("td",{className:"no-col",children:c+1}),(0,b.jsx)("td",{children:{BANGUNAN:"Dana Bangunan",KESEHATAN:"Biaya Kesehatan",EHB:"Biaya EHB",EKSKUL:"Biaya Ekstrakurikuler"}[d=a.jenis_biaya]??d}),(0,b.jsx)("td",{className:"amount-col",children:f(a.nominal_bayar)})]},`${a.jenis_biaya}-${c}`)})}),(0,b.jsx)("tfoot",{children:(0,b.jsxs)("tr",{children:[(0,b.jsx)("td",{colSpan:2,children:"TOTAL PEMBAYARAN INI"}),(0,b.jsx)("td",{className:"amount-col",children:f(m)})]})})]}),(0,b.jsx)("p",{className:"arrears-caption",children:"Catatan - sisa tagihan yang belum terbayar:"}),(0,b.jsxs)("table",{className:"arrears-table",children:[(0,b.jsx)("thead",{children:(0,b.jsxs)("tr",{children:[(0,b.jsx)("th",{children:"Item"}),(0,b.jsx)("th",{className:"amount-col",children:"Sisa (Rp)"})]})}),(0,b.jsxs)("tbody",{children:[(0,b.jsxs)("tr",{children:[(0,b.jsx)("td",{children:"PSB"}),(0,b.jsx)("td",{className:"amount-col due-zero",children:"Rp 0"})]}),(0,b.jsxs)("tr",{className:"total-arrears",children:[(0,b.jsx)("td",{children:"Total Sisa Tunggakan"}),(0,b.jsx)("td",{className:"amount-col due-zero",children:"Rp 0"})]})]})]}),(0,b.jsxs)("div",{className:"summary-block",children:[(0,b.jsx)("div",{}),(0,b.jsx)("table",{children:(0,b.jsxs)("tbody",{children:[(0,b.jsxs)("tr",{children:[(0,b.jsx)("td",{children:"JUMLAH"}),(0,b.jsx)("td",{children:":"}),(0,b.jsx)("td",{children:f(m)})]}),(0,b.jsxs)("tr",{children:[(0,b.jsx)("td",{children:"PEMBAYARAN"}),(0,b.jsx)("td",{children:":"}),(0,b.jsx)("td",{children:f(m)})]}),(0,b.jsxs)("tr",{children:[(0,b.jsx)("td",{children:"KEMBALI"}),(0,b.jsx)("td",{children:":"}),(0,b.jsx)("td",{children:"Rp 0"})]})]})})]}),(0,b.jsxs)("section",{className:"signature-section",children:[(0,b.jsxs)("div",{className:"signature-box",children:[(0,b.jsx)("p",{children:"Penyetor / Santri"}),(0,b.jsx)("div",{className:"signature-line"}),(0,b.jsxs)("strong",{children:["( ",o," )"]})]}),(0,b.jsxs)("div",{className:"signature-box",children:[(0,b.jsxs)("p",{children:["Tasikmalaya, ",g(a.created_at),(0,b.jsx)("br",{}),"Bendahara"]}),(0,b.jsx)("div",{className:"signature-line"}),(0,b.jsxs)("strong",{children:["( ",p," )"]})]})]}),(0,b.jsxs)("footer",{className:"receipt-footer",children:[(0,b.jsxs)("span",{children:["Dicetak: ",new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(h))]}),(0,b.jsx)("span",{children:"Dokumen ini sah tanpa tanda tangan basah jika dicetak dari sistem"}),(0,b.jsx)("span",{children:"PSB"})]})]})}function i({label:a,value:c,strong:d=!1}){return(0,b.jsxs)("div",{className:"info-row",children:[(0,b.jsx)("span",{children:a}),(0,b.jsx)("b",{children:":"}),d?(0,b.jsx)("strong",{children:c}):(0,b.jsx)("em",{children:c})]})}async function j({params:a}){let{id:c}=await a,f=await (0,e.getPsbReceipt)(c);if("error"in f)return(0,d.notFound)();let{receipt:g,items:i}=f,j=new Date().toISOString();return(0,b.jsxs)("main",{className:"receipt-page",children:[(0,b.jsx)("div",{className:"print-actions",children:(0,b.jsx)("span",{children:"Gunakan Ctrl+P untuk mencetak"})}),(0,b.jsx)(h,{receipt:g,items:i,label:"Lembar Pembayar",printedAt:j}),(0,b.jsx)("div",{className:"copy-divider"}),(0,b.jsx)(h,{receipt:g,items:i,label:"Arsip Pondok",printedAt:j}),(0,b.jsx)("style",{children:`
        .receipt-page {
          min-height: 100vh;
          background: #f5f5f5;
          padding: 14px 0;
          color: #111;
          font-family: "Times New Roman", Times, serif;
        }
        .print-actions {
          width: 210mm;
          margin: 0 auto 8px;
          text-align: right;
          font-family: Arial, sans-serif;
        }
        .print-actions span {
          display: inline-block;
          border: 1px solid #bbb;
          border-radius: 4px;
          background: white;
          padding: 5px 9px;
          font-size: 11px;
          color: #444;
        }
        .receipt-copy {
          position: relative;
          width: 210mm;
          height: 147.5mm;
          margin: 0 auto;
          box-sizing: border-box;
          background: #fff;
          padding: 3mm 10mm 5.5mm;
          overflow: hidden;
        }
        .receipt-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          height: 14mm;
          text-align: left;
        }
        .receipt-header img {
          width: 13mm;
          height: 13mm;
          object-fit: contain;
        }
        .school-heading {
          min-width: 0;
        }
        .school-heading h1,
        .school-heading h2,
        .school-heading p {
          margin: 0;
        }
        .school-heading h1 {
          font-family: Arial, sans-serif;
          font-size: 12px;
          font-weight: 900;
          line-height: 1.05;
        }
        .school-heading h2 {
          font-family: Arial, sans-serif;
          font-size: 13px;
          font-weight: 900;
          line-height: 1.1;
        }
        .school-heading p {
          margin-top: 1px;
          font-family: Arial, sans-serif;
          font-size: 7.8px;
          line-height: 1.15;
        }
        .header-rule {
          height: 0;
          margin: 1mm 0 1.5mm;
          border-top: 2px solid #111;
        }
        .copy-label {
          display: inline-block;
          margin-left: 0;
          margin-bottom: 2mm;
          border: 1px solid #b7b7b7;
          border-radius: 999px;
          padding: 1px 8px;
          font-size: 7px;
          color: #777;
          background: #fff;
        }
        .intro-grid {
          display: grid;
          grid-template-columns: 42% 1fr 32%;
          column-gap: 7px;
          align-items: start;
          margin-bottom: 2mm;
        }
        .student-info,
        .receipt-info {
          padding-top: 0;
        }
        .info-row {
          display: grid;
          grid-template-columns: 25mm 4px 1fr;
          column-gap: 2px;
          min-height: 3.2mm;
          align-items: baseline;
          font-size: 8px;
          line-height: 1.12;
        }
        .receipt-info .info-row {
          grid-template-columns: 17mm 4px 1fr;
        }
        .info-row span,
        .info-row b {
          font-weight: 400;
          color: #555;
        }
        .info-row strong {
          font-style: normal;
          font-weight: 800;
          color: #111;
          text-transform: uppercase;
        }
        .info-row em {
          font-style: normal;
          color: #111;
        }
        .payment-title {
          text-align: center;
          padding-top: 0;
        }
        .payment-title h3 {
          margin: 0;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .08em;
          line-height: 1;
        }
        .payment-title p {
          margin: 3px 0 0;
          color: #777;
          font-size: 7px;
        }
        .terbilang {
          display: flex;
          align-items: center;
          gap: 5px;
          min-height: 4.8mm;
          border: 1px solid #9a9a9a;
          padding: 1px 5px;
          box-sizing: border-box;
          font-size: 7.8px;
          color: #555;
        }
        .terbilang strong {
          color: #111;
          font-size: 7.8px;
          font-style: italic;
          font-weight: 800;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        .main-table {
          margin-top: 1.6mm;
          font-size: 7.8px;
        }
        .main-table th {
          background: #111;
          color: #fff;
          padding: 1.5px 4px;
          border-right: 1px solid #555;
          text-align: left;
          font-weight: 800;
        }
        .main-table th:last-child {
          border-right: 0;
        }
        .main-table td {
          padding: 1.5px 4px;
          border-bottom: 1px solid #ddd;
        }
        .main-table tfoot td {
          border-top: 2px solid #111;
          border-bottom: 0;
          background: #f1f1f1;
          font-weight: 900;
          text-align: center;
        }
        .no-col {
          width: 8mm;
          text-align: center !important;
        }
        .amount-col {
          width: 32mm;
          text-align: right !important;
          font-family: "Courier New", monospace;
          font-weight: 700;
        }
        .arrears-caption {
          margin: 2mm 0 .8mm;
          font-size: 7.2px;
          font-style: italic;
          color: #666;
        }
        .arrears-table {
          font-size: 7.2px;
          color: #111;
        }
        .arrears-table th {
          padding: 1.4px 4px;
          border: 1px solid #ddd;
          background: #f3f3f3;
          text-align: left;
          font-weight: 800;
        }
        .arrears-table td {
          padding: 1.4px 4px;
          border: 1px solid #eee;
        }
        .total-arrears td {
          background: #fff1f1;
          font-weight: 800;
        }
        .due-zero {
          color: #c00;
        }
        .summary-block {
          display: grid;
          grid-template-columns: 1fr 44mm;
          margin-top: 1.7mm;
          font-size: 7.8px;
        }
        .summary-block table td {
          padding: .5px 0;
          border: 0;
        }
        .summary-block table td:nth-child(1) {
          width: 18mm;
        }
        .summary-block table td:nth-child(2) {
          width: 3mm;
          text-align: center;
        }
        .summary-block table td:nth-child(3) {
          font-family: "Courier New", monospace;
          font-weight: 800;
          text-align: right;
        }
        .signature-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14mm;
          margin-top: 2mm;
          padding: 0 12mm;
          text-align: center;
          font-size: 7.7px;
        }
        .signature-box p {
          height: 8.5mm;
          margin: 0;
          line-height: 1.25;
        }
        .signature-line {
          border-top: 1px solid #111;
          height: 0;
          margin: 0 auto 1mm;
        }
        .signature-box strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 7.4px;
          font-weight: 800;
        }
        .receipt-footer {
          position: absolute;
          left: 10mm;
          right: 10mm;
          bottom: 2mm;
          display: grid;
          grid-template-columns: 1fr 1.4fr 1fr;
          gap: 4mm;
          border-top: 1px solid #ddd;
          padding-top: .7mm;
          font-size: 6.4px;
          color: #999;
        }
        .receipt-footer span:nth-child(2) {
          text-align: center;
        }
        .receipt-footer span:nth-child(3) {
          text-align: right;
        }
        .copy-divider {
          width: 210mm;
          height: 0;
          margin: 0 auto;
          border-top: .5px dashed #9b9b9b;
        }
        .paid-stamp {
          position: absolute;
          right: 34mm;
          bottom: 40mm;
          z-index: 0;
          transform: rotate(-13deg);
          border: 3px double rgba(10, 120, 56, .16);
          border-radius: 7px;
          padding: 4px 16px;
          color: rgba(10, 120, 56, .14);
          font-family: Arial, sans-serif;
          font-size: 28px;
          font-weight: 900;
          letter-spacing: .10em;
          pointer-events: none;
        }
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          .receipt-page {
            background: #fff;
            padding: 0;
          }
          .print-actions {
            display: none;
          }
          .receipt-copy {
            margin: 0;
          }
          .copy-divider {
            margin: 0;
          }
        }
      `})]})}a.s(["default",()=>j,"dynamic",0,"force-dynamic"])}];

//# sourceMappingURL=_074246b0._.js.map