// Models
// NOTE: `gemini-2.0-flash` may be unavailable for some/new API projects.
export const GEMINI_MODEL = 'gemini-2.5-flash-lite';

export const SAMPLE_STATEMENT_TEXT = `Date,Description,Amount
2023-10-01,Uber Trip,24.50
2023-10-02,Starbucks,5.40
2023-10-03,United Airlines,450.00
2023-10-04,Netflix Subscription,15.99
2023-10-05,WeWork Space,300.00
2023-10-06,Whole Foods Market,89.20
2023-10-07,AWS Web Services,120.50
2023-10-08,Cinema City,25.00`;

// Added sample sheets for DataIngest
export const SAMPLE_SHEET_A = `ID,Name,Role,Department
1,Alice,Manager,Sales
2,Bob,Developer,Engineering
3,Charlie,Designer,Product`;

export const SAMPLE_SHEET_B = `Date,Task,Hours,Status
2023-10-01,Meeting,1.5,Completed
2023-10-01,Coding,4.0,In Progress
2023-10-02,Design,3.0,Pending`;

// Full Employee List from CSV
export const EMPLOYEES_LIST = [
  { name: "LEE JIA WEI 950401-01-5959", account: "25102100067245", bank: "RHB" },
  { name: "SOH LAY INK 950404-01-5604", account: "20130360050200", bank: "RHB" },
  { name: "GOH SEK FANG 911107-01-5518", account: "343131603108", bank: "HSBC" },
  { name: "TAN TZE WEI 951109-01-7089", account: "20130360052629", bank: "RHB" },
  { name: "LIM JIA XIN 980916-01-6560", account: "20130360052610", bank: "RHB" },
  { name: "TRICIA GOH SUEH YIN 970329-01-6700", account: "20130360050251", bank: "RHB" },
  { name: "EILEEN TEYO CHENG YEE 970621-01-6230", account: "20102600192408", bank: "RHB" },
  { name: "LIM FENG YUN 950325-01-5702", account: "20102600194133", bank: "RHB" },
  { name: "SHARLYN CHUA LERK CHIH 920912-01-6622", account: "20102600179509", bank: "RHB" },
  { name: "IRENE SIA WEI XING 000419-01-2116", account: "25102100082511", bank: "RHB" },
  { name: "LIM JIA YEE 001221-01-0072", account: "25102100082694", bank: "RHB" },
  { name: "NG WEI PENG 011120-01 -0398", account: "25102100082724", bank: "RHB" },
  { name: "TAN CHIA HUI 010606-01-0844", account: "25102100082716", bank: "RHB" },
  { name: "TAN YIN MAY 950725-06-5952", account: "25130360047528", bank: "RHB" },
  { name: "ADILLA SOFIA BINTI IDHAM KHALID 960906-01-6796", account: "25102100082520", bank: "RHB" },
  { name: "SITI NURNATASSA BINTI MD NOR HAMKA 040507-01-1216", account: "25102100082538", bank: "RHB" },
  { name: "NURUL RAUDHAH BINTI ABDUL GHAFAR 000906-01-0046", account: "25102100082546", bank: "RHB" },
  { name: "LOOI NOOI YUAN 891113-01-5041", account: "20135200038700", bank: "RHB" },
  { name: "NUR DIANA ARISHA BINTI IDHAM KHALID 980704-01-7166", account: "25102100082554", bank: "RHB" },
  { name: "NUR HIDAYAH BINTI MOHD YATIM 000819-01-0048", account: "25102100082708", bank: "RHB" },
  { name: "AHMAD ALIFF IRFAN BIN AHMAD KAMARULZAMAN 021008-01-1509", account: "25102100082562", bank: "RHB" },
  { name: "NOR AIFAIZZAH BINTI BOONSOO 971003-23-5000", account: "25102100082570", bank: "RHB" },
  { name: "SITI NURAIN BINTI MOHD TAUFIK 010605-01-0164", account: "20146400001864", bank: "RHB" },
  { name: "DANIEL MUQHRIZ BIN MOHAMMAD FAIZAL 000311-01-1963", account: "200760362972", bank: "AFB" },
  { name: "MOHAMAD SHAHRIL EIZLAN BIN MOHAMAD ZAHARIN 970304-01-6771", account: "551427183151", bank: "MBB" },
  { name: "MUHD AMIRUL ARIF BIN JOMAAT 010814-01-0697", account: "16601600297317", bank: "RHB" },
  { name: "LEE JIN YI 900127-01-5036", account: "26218400039253", bank: "RHB" },
  { name: "NG XIN EN 050516-08-0706", account: "25102100082449", bank: "RHB" },
  { name: "CELINE CHAN ZI YI 030228-02-0436", account: "151204398585", bank: "MBB" },
  { name: "GOH WEE LE 900116-01-5129", account: "25102100082465", bank: "RHB" },
  { name: "SOH BOON BANK 971011-01-7003", account: "25102100082473", bank: "RHB" },
  { name: "TAN TA YEW 950218-01-6347", account: "25102100082481", bank: "RHB" },
  { name: "WONG SHI YUAN 010501-01-0792", account: "25141400058331", bank: "RHB" },
  { name: "TEE WEI NI 021118-01-0814", account: "25102100082490", bank: "RHB" },
  { name: "NURFARAH ADILA BINTI ABDUL RAHIM 920317-01-6564", account: "25102100082503", bank: "RHB" },
  { name: "TAN KO-FUNG 850926-08-5871", account: "25102100082457", bank: "RHB" },
  { name: "MUHAMMAD SYAFIQ IZZUDDIN BIN ABDUL SAMAD 960716-14-6063", account: "25102100082422", bank: "RHB" },
  { name: "YEOH CHOON SHEN 960103-07-5071", account: "25102100082430", bank: "RHB" },
  { name: "HO LAY SAN 751101-01-5090", account: "20130360050197", bank: "RHB" },
  { name: "AIMA NORAINA BINTI AYOB 001029-01-0208", account: "20130360050260", bank: "RHB" },
  { name: "NUR NABILA NATASHA BINTI AZLEE 990909-01-7046", account: "20130360050219", bank: "RHB" }
];
