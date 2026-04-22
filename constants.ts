// Models
export const GEMINI_MODEL = 'gemini-2.0-flash'; 

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
  { name: "EILEEN TEYO CHENG YEE 970621-01-6230", account: "112820124995", bank: "MBB" },
  { name: "LIM FENG YUN 950325-01-5702", account: "10102601243508", bank: "RHB" },
  { name: "SHARLYN CHUA LERK CHIH 920912-01-6622", account: "20102600179509", bank: "RHB" },
  { name: "LEE SING TING 941110-04-5176", account: "9093705153", bank: "UOB" },
  { name: "IRENE SIA WEI XING 000419-01-2116", account: "151463364292", bank: "MBB" },
  { name: "TAN CHIA HUI 010606-01-0844", account: "5029775900", bank: "PBB" },
  { name: "LIM JIA YEE 001221-01-0072", account: "7640215408", bank: "CIMB" },
  { name: "NG WEI PENG 011120-01 -0398", account: "151584268471", bank: "MBB" },
  { name: "ADILLA SOFIA 960906-01-6796", account: "151017441647", bank: "MBB" },
  { name: "SITI NURNATASSA BINTI MD NOR HAMKA 040507-01-1216", account: "551427180283", bank: "MBB" },
  { name: "NURUL RAUDHAH BINTI A/B GHAFAR 000906-01-0046", account: "551249616343", bank: "MBB" },
  { name: "LOOI NOOI YUAN 891113-01-5041", account: "20135200038700", bank: "RHB" },
  { name: "NUR DIANA ARISHA BINTI IDHAM KHALID 980704-01-7166", account: "151463208100", bank: "MBB" },
  { name: "NUR HIDAYAH BINTI MOHD YATIM 000819-01-0048", account: "15102100289626", bank: "RHB" },
  { name: "AHMAD ALIFF IRFAN BIN AHMAD KAMARULZAMAN 021008-01-1509", account: "551463145756", bank: "MBB" },
  { name: "NOR AIFAIZZAH BINTI BOONSOO 971003-23-5000", account: "7624188041", bank: "CIMB" },
  { name: "SITI NURAIN BINTI MOHD TAUFIK 010605-01-0164", account: "20146400001864", bank: "RHB" },
  { name: "DANIEL MUQHRIZ BIN MOHAMMAD FAIZAL 000311-01-1963", account: "200760362972", bank: "AFB" },
  { name: "NURSYAZA FILZAH BINTI MUHD FAISAL 010128-01-0638", account: "8881054452502", bank: "AMB" },
  { name: "HO LAY SAN 751101-01-5090", account: "20130360050197", bank: "RHB" },
  { name: "NUR NABILA NATASHA BINTI AZLEE 990909-01-7046", account: "20130360050219", bank: "RHB" },
  { name: "AIMA NORAINA BINTI AYOB 001029-01-0208", account: "20130360050260", bank: "RHB" },
  { name: "NURUL AFIDAH BINTI TAHER 870420-23-5690", account: "151463118773", bank: "MBB" },
  { name: "NUR SUHAILA BINTI ABDUL LATIF 010502-06-0214", account: "156076113987", bank: "MBB" },
  { name: "TUHINUZZAMAN EK0821134", account: "20130360050189", bank: "RHB" },
  { name: "KARIM MOHAMMAD REGAUL EK0481052", account: "25146900006692", bank: "RHB" },
  { name: "MD AKTARUZZAMAN EK0479036", account: "25146900006684", bank: "RHB" },
  { name: "NASIR ABU EN0234269", account: "Oriental", bank: "" }, 
  { name: "HOSSAIN JAMRUL A17888575", account: "25146900002735", bank: "RHB" },
  { name: "MD YOUNUS ALI A07349910", account: "cash", bank: "" },
  { name: "SHOFIQUL EL0603055", account: "cash", bank: "" },
  { name: "MD SOJIB ALI A05728112", account: "cash", bank: "" },
  { name: "MD RAIHAN KABIR POLASH A06516847", account: "25102100069710", bank: "RHB" },
  { name: "SOJIB MD A01008195", account: "cash", bank: "" },
  { name: "JAMAN MOHAMMED EH0607792", account: "5116346535", bank: "PBB" },
  { name: "SUMON B00497701", account: "cash", bank: "" },
  { name: "HABIBUR RAHMAN EN0292034", account: "cash", bank: "" },
  { name: "LEE JIN YI 900127-01-5036", account: "16650111154", bank: "HLB" },
  { name: "MUHAMMAD SYAFIQ IZZUDDIN BIN ABDUL SAMAD 960716-14-6063", account: "112781079845", bank: "MBB" },
  { name: "NG XIN EN 050516-08-0706", account: "6947466530", bank: "PBB" },
  { name: "NG LIN ZE 061019-08-0901", account: "114414127783", bank: "MBB" },
  { name: "SOH BOON BANK 971011-01-7003", account: "151463255663", bank: "MBB" },
  { name: "GOH WEE LE 900116-01-5129", account: "1823059162", bank: "UOB" },
  { name: "TAN TA YEW 950218-01-6347", account: "151463251552", bank: "MBB" }
];