import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ─── DATOS GEOGRÁFICOS ────────────────────────────────────────────────────────
const WORLD_COUNTRIES = {
  PT: { name:"Portugal", continent:"europe", path:"M455.2,185.4L463.5,185.8L462.4,189.7L461.3,194.6L456.0,194.8L454.7,190.7Z", cx:458.8, cy:190.2 },
  ES: { name:"España", continent:"europe", path:"M456.0,182.2L475.2,183.0L488.8,184.9L488.5,189.1L480.8,191.3L478.7,192.7L480.5,193.4L476.0,195.1L465.6,196.3L455.2,194.4L456.5,188.6L461.3,189.3L462.4,185.8L456.5,185.6Z", cx:470.2, cy:189.5 },
  FR: { name:"Francia", continent:"europe", path:"M467.2,173.0L486.7,167.2L501.9,171.7L500.3,174.6L496.0,177.1L485.6,183.0L475.2,183.0L467.7,175.0Z", cx:485.1, cy:175.7 },
  GB: { name:"Reino Unido", continent:"europe", path:"M466.1,169.6L484.8,166.5L484.0,162.9L479.7,160.5L474.7,156.2L470.7,149.0L463.7,149.3L466.1,159.1L471.5,166.5L464.8,166.5Z", cx:472.6, cy:160.8 },
  IE: { name:"Irlanda", continent:"europe", path:"M452.0,166.5L464.0,165.6L464.0,157.2L458.1,157.2L452.0,160.5Z", cx:458.0, cy:161.5 },
  NL: { name:"Países Bajos", continent:"europe", path:"M489.1,166.5L499.2,161.7L498.7,165.2L493.1,163.8L489.1,166.5Z", cx:493.8, cy:164.8 },
  BE: { name:"Bélgica", continent:"europe", path:"M486.7,170.6L497.1,167.8L496.5,170.6L487.5,171.1Z", cx:491.9, cy:170.1 },
  DE: { name:"Alemania", continent:"europe", path:"M496.0,175.3L520.0,175.0L520.0,158.6L506.7,158.1L501.3,158.4L496.0,167.4Z", cx:506.7, cy:165.8 },
  CH: { name:"Suiza", continent:"europe", path:"M495.7,174.2L508.0,174.2L508.0,178.3L495.7,178.3Z", cx:501.9, cy:176.3 },
  AT: { name:"Austria", continent:"europe", path:"M506.7,173.8L525.9,173.8L525.9,177.1L506.7,177.1Z", cx:516.3, cy:175.5 },
  IT: { name:"Italia", continent:"europe", path:"M498.7,182.2L517.3,181.4L521.3,187.5L522.7,192.7L521.6,193.0L513.1,193.6L507.7,192.9L501.3,189.3L500.0,181.6Z", cx:511.5, cy:188.3 },
  SE: { name:"Suecia", continent:"europe", path:"M509.6,157.2L514.7,157.2L530.7,145.2L544.5,128.1L538.7,117.8L528.0,112.7L517.3,126.1L510.7,147.9Z", cx:524.3, cy:138.0 },
  NO: { name:"Noruega", continent:"europe", path:"M492.3,150.9L493.3,139.5L496.0,138.6L520.0,111.9L554.7,107.7L560.0,110.3L554.7,115.9L546.7,130.1L525.3,145.2L512.0,150.6Z", cx:525.5, cy:131.6 },
  DK: { name:"Dinamarca", continent:"europe", path:"M501.6,158.4L513.9,156.2L513.9,155.4L508.3,151.4L501.6,153.2Z", cx:507.8, cy:154.9 },
  FI: { name:"Finlandia", continent:"europe", path:"M533.3,146.0L554.1,143.8L558.9,142.1L557.3,115.9L552.0,111.5L546.7,111.5L534.9,112.7L533.3,136.5Z", cx:546.3, cy:128.8 },
  PL: { name:"Polonia", continent:"europe", path:"M517.6,160.5L541.1,159.6L544.3,164.9L542.9,169.1L530.4,171.7L517.6,167.6Z", cx:532.3, cy:165.7 },
  CZ: { name:"Chequia", continent:"europe", path:"M513.3,168.5L530.4,168.5L530.4,172.6L513.3,172.6Z", cx:521.9, cy:170.5 },
  SK: { name:"Eslovaquia", continent:"europe", path:"M525.3,170.4L540.3,170.4L540.3,174.4L525.3,174.4Z", cx:532.8, cy:172.4 },
  HU: { name:"Hungría", continent:"europe", path:"M522.9,173.8L541.1,173.8L541.1,178.5L522.9,178.5Z", cx:532.0, cy:176.2 },
  RO: { name:"Rumanía", continent:"europe", path:"M538.7,173.2L559.2,173.2L559.2,182.6L538.7,182.6Z", cx:548.9, cy:178.0 },
  BG: { name:"Bulgaria", continent:"europe", path:"M539.7,181.4L556.3,181.4L556.3,187.1L539.7,187.1Z", cx:548.0, cy:184.3 },
  GR: { name:"Grecia", continent:"europe", path:"M533.3,186.0L550.9,186.0L550.9,195.7L533.3,195.7Z", cx:542.1, cy:190.9 },
  RS: { name:"Serbia", continent:"europe", path:"M530.1,177.5L541.1,177.5L541.1,185.2L530.1,185.2Z", cx:535.6, cy:181.4 },
  HR: { name:"Croacia", continent:"europe", path:"M516.0,176.9L531.7,176.9L531.7,184.9L516.0,184.9Z", cx:523.9, cy:180.9 },
  UA: { name:"Ucrania", continent:"europe", path:"M538.9,164.3L587.2,164.3L587.2,181.0L538.9,181.0Z", cx:563.1, cy:173.0 },
  BY: { name:"Bielorrusia", continent:"europe", path:"M541.9,160.8L567.5,160.8L567.5,166.7L541.9,166.7Z", cx:554.7, cy:163.8 },
  MD: { name:"Moldavia", continent:"europe", path:"M550.9,172.8L560.5,172.8L560.5,179.1L550.9,179.1Z", cx:555.7, cy:176.0 },
  RU: { name:"Rusia", continent:"europe", path:"M554.7,103.4L613.3,103.4L693.3,93.8L853.3,103.4L906.7,119.7L986.7,119.7L986.7,169.6L853.3,185.6L746.7,185.6L640.0,181.8L613.3,173.8L586.7,173.8L573.3,175.9L554.7,155.7Z", cx:725.9, cy:152.3 },
  TR: { name:"Turquía", continent:"europe", path:"M549.3,185.4L599.5,185.4L599.5,196.3L576.0,196.3L549.3,196.3Z", cx:574.7, cy:192.1 },
  LV: { name:"Letonia", continent:"europe", path:"M536.0,151.1L555.2,151.1L555.2,156.4L536.0,156.4Z", cx:545.6, cy:153.8 },
  LT: { name:"Lituania", continent:"europe", path:"M536.0,154.4L551.5,154.4L551.5,160.8L536.0,160.8Z", cx:543.7, cy:157.7 },
  EE: { name:"Estonia", continent:"europe", path:"M538.1,146.0L555.2,146.0L555.2,151.9L538.1,151.9Z", cx:546.7, cy:149.0 },
  GE: { name:"Georgia", continent:"asia", path:"M586.9,182.6L604.3,182.6L604.3,187.5L586.9,187.5Z", cx:595.6, cy:185.0 },
  AZ: { name:"Azerbaiyán", continent:"asia", path:"M599.5,185.8L614.4,185.8L614.4,192.2L599.5,192.2Z", cx:606.9, cy:189.0 },
  AM: { name:"Armenia", continent:"asia", path:"M596.3,186.9L604.3,186.9L604.3,191.4L596.3,191.4Z", cx:600.3, cy:189.2 },
  IL: { name:"Israel", continent:"asia", path:"M571.5,200.9L575.7,200.9L575.7,207.1L571.5,207.1Z", cx:573.6, cy:204.0 },
  SY: { name:"Siria", continent:"asia", path:"M575.2,194.1L593.1,194.1L593.1,202.6L575.2,202.6Z", cx:584.1, cy:198.4 },
  LB: { name:"Líbano", continent:"asia", path:"M573.6,198.6L577.6,198.6L577.6,201.2L573.6,201.2Z", cx:575.6, cy:199.9 },
  JO: { name:"Jordania", continent:"asia", path:"M573.1,200.7L584.8,200.7L584.8,207.6L573.1,207.6Z", cx:578.9, cy:204.2 },
  IQ: { name:"Irak", continent:"asia", path:"M583.5,193.9L609.6,193.9L609.6,207.7L583.5,207.7Z", cx:596.5, cy:201.0 },
  IR: { name:"Irán", continent:"asia", path:"M597.3,189.7L648.8,189.7L648.8,214.0L597.3,214.0Z", cx:623.1, cy:202.3 },
  KW: { name:"Kuwait", continent:"asia", path:"M604.3,206.1L609.1,206.1L609.1,208.7L604.3,208.7Z", cx:606.7, cy:207.4 },
  SA: { name:"Arabia Saudita", continent:"asia", path:"M577.9,202.7L628.5,202.7L628.5,226.9L577.9,226.9Z", cx:603.2, cy:215.2 },
  YE: { name:"Yemen", continent:"asia", path:"M594.7,223.1L625.3,223.1L625.3,233.1L594.7,233.1Z", cx:610.0, cy:228.1 },
  OM: { name:"Omán", continent:"asia", path:"M618.7,214.7L639.5,214.7L639.5,226.6L618.7,226.6Z", cx:629.1, cy:220.8 },
  AE: { name:"Emiratos Árabes", continent:"asia", path:"M617.6,212.4L630.4,212.4L630.4,217.8L617.6,217.8Z", cx:624.0, cy:215.1 },
  QA: { name:"Catar", continent:"asia", path:"M615.5,212.3L617.6,212.3L617.6,214.9L615.5,214.9Z", cx:616.5, cy:213.6 },
  AF: { name:"Afganistán", continent:"asia", path:"M642.7,192.0L679.7,192.0L679.7,207.2L642.7,207.2Z", cx:661.2, cy:199.8 },
  PK: { name:"Pakistán", continent:"asia", path:"M642.7,194.4L685.3,194.4L685.3,216.1L642.7,216.1Z", cx:664.0, cy:205.6 },
  KZ: { name:"Kazajistán", continent:"asia", path:"M616.5,157.2L713.1,157.2L713.1,188.2L616.5,188.2Z", cx:664.8, cy:173.8 },
  UZ: { name:"Uzbekistán", continent:"asia", path:"M629.3,186.0L675.2,186.0L675.2,194.3L629.3,194.3Z", cx:652.3, cy:190.2 },
  TM: { name:"Turkmenistán", continent:"asia", path:"M621.3,184.1L657.9,184.1L657.9,197.9L621.3,197.9Z", cx:639.6, cy:191.2 },
  CN: { name:"China", continent:"asia", path:"M676.0,161.5L840.3,161.5L840.3,224.3L676.0,224.3Z", cx:758.1, cy:196.5 },
  MN: { name:"Mongolia", continent:"asia", path:"M713.9,171.3L799.7,171.3L799.7,186.4L713.9,186.4Z", cx:756.8, cy:179.1 },
  IN: { name:"India", continent:"asia", path:"M661.9,194.4L739.7,194.4L739.7,239.0L661.9,239.0Z", cx:700.8, cy:217.9 },
  NP: { name:"Nepal", continent:"asia", path:"M693.6,205.6L715.2,205.6L715.2,212.0L693.6,212.0Z", cx:704.4, cy:208.8 },
  BD: { name:"Bangladés", continent:"asia", path:"M714.7,212.0L727.2,212.0L727.2,220.6L714.7,220.6Z", cx:720.9, cy:216.3 },
  LK: { name:"Sri Lanka", continent:"asia", path:"M692.5,236.3L698.4,236.3L698.4,241.8L692.5,241.8Z", cx:695.5, cy:239.1 },
  JP: { name:"Japón", continent:"asia", path:"M825.3,178.9L868.8,178.9L868.8,204.7L825.3,204.7Z", cx:847.1, cy:192.4 },
  KR: { name:"Corea del Sur", continent:"asia", path:"M816.3,191.8L825.6,191.8L825.6,199.7L816.3,199.7Z", cx:820.9, cy:195.8 },
  KP: { name:"Corea del Norte", continent:"asia", path:"M811.5,184.7L828.5,184.7L828.5,193.4L811.5,193.4Z", cx:820.0, cy:189.1 },
  TW: { name:"Taiwán", continent:"asia", path:"M800.0,213.7L805.1,213.7L805.1,218.7L800.0,218.7Z", cx:802.5, cy:216.2 },
  MM: { name:"Myanmar", continent:"asia", path:"M725.9,208.7L749.9,208.7L749.9,236.6L725.9,236.6Z", cx:737.9, cy:223.0 },
  TH: { name:"Tailandia", continent:"asia", path:"M739.7,220.9L761.6,220.9L761.6,242.2L739.7,242.2Z", cx:750.7, cy:231.7 },
  LA: { name:"Laos", continent:"asia", path:"M746.9,217.9L767.2,217.9L767.2,230.5L746.9,230.5Z", cx:757.1, cy:224.3 },
  VN: { name:"Vietnam", continent:"asia", path:"M752.3,216.6L772.0,216.6L772.0,238.3L752.3,238.3Z", cx:762.1, cy:227.6 },
  KH: { name:"Camboya", continent:"asia", path:"M752.8,229.4L766.9,229.4L766.9,235.6L752.8,235.6Z", cx:759.9, cy:232.5 },
  MY: { name:"Malasia", continent:"asia", path:"M745.6,238.0L798.1,238.0L798.1,248.7L745.6,248.7Z", cx:771.9, cy:243.4 },
  ID: { name:"Indonesia", continent:"asia", path:"M733.3,241.5L856.0,241.5L856.0,262.3L733.3,262.3Z", cx:794.7, cy:251.9 },
  PH: { name:"Filipinas", continent:"asia", path:"M792.5,220.3L817.6,220.3L817.6,243.0L792.5,243.0Z", cx:805.1, cy:231.9 },
  MA: { name:"Marruecos", continent:"africa", path:"M464.3,196.5L477.3,196.5L477.3,209.5L464.3,209.5L444.8,209.9L434.7,220.5L444.8,220.5Z", cx:458.2, cy:209.2 },
  DZ: { name:"Argelia", continent:"africa", path:"M474.1,194.4L504.0,194.4L504.0,223.0L474.1,223.0Z", cx:489.1, cy:209.3 },
  TN: { name:"Túnez", continent:"africa", path:"M500.0,194.1L510.9,194.1L510.9,206.0L500.0,206.0Z", cx:505.5, cy:200.2 },
  LY: { name:"Libia", continent:"africa", path:"M504.8,201.1L547.2,201.1L547.2,222.4L504.8,222.4Z", cx:526.0, cy:212.0 },
  EG: { name:"Egipto", continent:"africa", path:"M545.9,203.5L578.4,203.5L578.4,218.8L545.9,218.8Z", cx:562.1, cy:211.3 },
  MR: { name:"Mauritania", continent:"africa", path:"M434.4,210.1L467.2,210.1L467.2,229.4L434.4,229.4Z", cx:450.8, cy:219.9 },
  ML: { name:"Mali", continent:"africa", path:"M468.5,214.1L491.5,214.1L491.5,235.8L468.5,235.8Z", cx:480.0, cy:225.2 },
  NE: { name:"Níger", continent:"africa", path:"M485.9,216.4L522.4,216.4L522.4,233.6L485.9,233.6Z", cx:504.1, cy:225.2 },
  SD: { name:"Sudán", continent:"africa", path:"M542.9,218.4L582.7,218.4L582.7,236.9L542.9,236.9Z", cx:562.8, cy:227.8 },
  SS: { name:"Sudán del Sur", continent:"africa", path:"M544.3,232.9L575.7,232.9L575.7,245.1L544.3,245.1Z", cx:560.0, cy:239.1 },
  ET: { name:"Etiopía", continent:"africa", path:"M568.0,228.9L608.0,228.9L608.0,245.3L568.0,245.3Z", cx:588.0, cy:237.2 },
  SO: { name:"Somalia", continent:"africa", path:"M589.3,233.2L617.1,233.2L617.1,247.8L589.3,247.8Z", cx:603.2, cy:240.5 },
  ER: { name:"Eritrea", continent:"africa", path:"M577.1,224.6L594.9,224.6L594.9,232.6L577.1,232.6Z", cx:586.0, cy:228.6 },
  DJ: { name:"Yibuti", continent:"africa", path:"M592.0,232.6L596.3,232.6L596.3,234.6L592.0,234.6Z", cx:594.1, cy:233.6 },
  SN: { name:"Senegal", continent:"africa", path:"M434.1,228.6L449.6,228.6L449.6,232.8L434.1,232.8Z", cx:441.9, cy:230.7 },
  GM: { name:"Gambia", continent:"africa", path:"M435.2,230.6L443.2,230.6L443.2,231.8L435.2,231.8Z", cx:439.2, cy:231.2 },
  GW: { name:"Guinea-Bisáu", continent:"africa", path:"M435.5,232.2L443.7,232.2L443.7,234.8L435.5,234.8Z", cx:439.6, cy:233.5 },
  GN: { name:"Guinea", continent:"africa", path:"M439.7,232.2L459.7,232.2L459.7,240.0L439.7,240.0Z", cx:449.7, cy:236.1 },
  SL: { name:"Sierra Leona", continent:"africa", path:"M444.5,236.0L452.5,236.0L452.5,240.4L444.5,240.4Z", cx:448.5, cy:238.2 },
  LR: { name:"Liberia", continent:"africa", path:"M449.3,238.0L460.3,238.0L460.3,243.9L449.3,243.9Z", cx:454.8, cy:241.0 },
  CI: { name:"Costa de Marfil", continent:"africa", path:"M457.1,235.1L473.3,235.1L473.3,244.0L457.1,244.0Z", cx:465.2, cy:239.6 },
  BF: { name:"Burkina Faso", continent:"africa", path:"M465.3,228.8L486.4,228.8L486.4,236.9L465.3,236.9Z", cx:475.9, cy:232.9 },
  GH: { name:"Ghana", continent:"africa", path:"M471.2,234.3L483.2,234.3L483.2,243.5L471.2,243.5Z", cx:477.2, cy:238.9 },
  TG: { name:"Togo", continent:"africa", path:"M479.7,234.5L484.8,234.5L484.8,241.5L479.7,241.5Z", cx:482.3, cy:238.0 },
  BJ: { name:"Benín", continent:"africa", path:"M482.1,232.6L490.1,232.6L490.1,241.4L482.1,241.4Z", cx:486.1, cy:237.0 },
  NG: { name:"Nigeria", continent:"africa", path:"M488.0,230.5L519.2,230.5L519.2,244.0L488.0,244.0Z", cx:503.6, cy:237.3 },
  CM: { name:"Camerún", continent:"africa", path:"M502.7,231.6L522.9,231.6L522.9,246.9L502.7,246.9Z", cx:512.8, cy:239.3 },
  CF: { name:"Rep. Centroafricana", continent:"africa", path:"M520.0,234.6L553.3,234.6L553.3,246.9L520.0,246.9Z", cx:536.7, cy:240.8 },
  TD: { name:"Chad", continent:"africa", path:"M517.3,216.6L544.0,216.6L544.0,239.6L517.3,239.6Z", cx:530.7, cy:228.3 },
  GQ: { name:"Guinea Ecuatorial", continent:"africa", path:"M504.8,244.7L510.4,244.7L510.4,248.7L504.8,248.7Z", cx:507.6, cy:246.7 },
  GA: { name:"Gabón", continent:"africa", path:"M503.2,246.8L518.7,246.8L518.7,255.4L503.2,255.4Z", cx:510.9, cy:251.1 },
  CG: { name:"Congo", continent:"africa", path:"M509.9,244.9L529.6,244.9L529.6,257.0L509.9,257.0Z", cx:519.7, cy:250.9 },
  CD: { name:"R.D. Congo", continent:"africa", path:"M512.5,242.5L563.5,242.5L563.5,268.9L512.5,268.9Z", cx:538.0, cy:255.6 },
  RW: { name:"Ruanda", continent:"africa", path:"M557.3,250.3L562.4,250.3L562.4,253.9L557.3,253.9Z", cx:559.9, cy:252.1 },
  BI: { name:"Burundi", continent:"africa", path:"M557.3,253.2L562.4,253.2L562.4,256.3L557.3,256.3Z", cx:559.9, cy:254.7 },
  UG: { name:"Uganda", continent:"africa", path:"M558.7,244.2L573.3,244.2L573.3,252.1L558.7,252.1Z", cx:566.0, cy:248.1 },
  KE: { name:"Kenia", continent:"africa", path:"M570.7,243.0L591.7,243.0L591.7,256.5L570.7,256.5Z", cx:581.2, cy:249.8 },
  TZ: { name:"Tanzania", continent:"africa", path:"M558.1,251.4L587.7,251.4L587.7,266.4L558.1,266.4Z", cx:572.9, cy:258.8 },
  AO: { name:"Angola", continent:"africa", path:"M511.2,257.0L544.3,257.0L544.3,275.4L511.2,275.4Z", cx:527.7, cy:266.1 },
  ZM: { name:"Zambia", continent:"africa", path:"M538.7,261.4L569.9,261.4L569.9,275.6L538.7,275.6Z", cx:554.3, cy:268.4 },
  MW: { name:"Malaui", continent:"africa", path:"M568.0,263.1L575.7,263.1L575.7,274.1L568.0,274.1Z", cx:571.9, cy:268.6 },
  MZ: { name:"Mozambique", continent:"africa", path:"M560.5,264.7L589.1,264.7L589.1,288.8L560.5,288.8Z", cx:574.8, cy:276.4 },
  ZW: { name:"Zimbabue", continent:"africa", path:"M547.2,271.9L568.3,271.9L568.3,281.9L547.2,281.9Z", cx:557.7, cy:276.9 },
  BW: { name:"Botsuana", continent:"africa", path:"M533.3,275.4L558.4,275.4L558.4,288.8L533.3,288.8Z", cx:545.9, cy:282.0 },
  NA: { name:"Namibia", continent:"africa", path:"M511.2,274.0L547.5,274.0L547.5,292.0L511.2,292.0Z", cx:529.3, cy:282.8 },
  ZA: { name:"Sudáfrica", continent:"africa", path:"M524.0,281.6L567.7,281.6L567.7,301.6L524.0,301.6Z", cx:545.9, cy:291.3 },
  LS: { name:"Lesoto", continent:"africa", path:"M552.0,291.5L558.7,291.5L558.7,294.7L552.0,294.7Z", cx:555.3, cy:293.1 },
  MG: { name:"Madagascar", continent:"africa", path:"M595.2,266.6L614.7,266.6L614.7,286.8L595.2,286.8Z", cx:604.9, cy:276.5 },
  SZ: { name:"Suazilandia", continent:"africa", path:"M562.1,287.0L565.6,287.0L565.6,289.4L562.1,289.4Z", cx:563.9, cy:288.2 },
  CA: { name:"Canadá", continent:"americas", path:"M104.3,144.9L104.3,113.5L320.0,111.9L339.7,175.9L301.3,180.6L293.3,183.7L260.0,185.0L253.9,178.1L245.3,173.2L226.1,171.7L151.2,171.7L151.2,173.0L104.3,160.5Z", cx:219.6, cy:166.0 },
  US: { name:"Estados Unidos", continent:"americas", path:"M147.5,172.8L301.6,180.3L301.6,214.9L264.0,214.7L246.4,205.8L220.3,212.9L200.8,207.7L184.0,204.2L167.7,202.2L147.5,193.2Z", cx:218.1, cy:201.5 },
  AK: { name:"Alaska", continent:"americas", path:"M32.0,111.9L104.0,111.9L104.0,145.8L32.0,160.5Z", cx:68.0, cy:135.1 },
  MX: { name:"México", continent:"americas", path:"M167.5,202.2L221.3,212.6L248.0,227.8L234.1,228.1L234.1,224.9L238.7,221.6L248.5,219.7L246.7,219.4L240.0,219.9L202.7,223.1L167.5,218.7Z", cx:222.6, cy:219.9 },
  GT: { name:"Guatemala", continent:"americas", path:"M234.1,224.9L242.4,224.9L242.4,230.8L234.1,230.8Z", cx:238.3, cy:227.8 },
  BZ: { name:"Belice", continent:"americas", path:"M242.1,223.8L246.7,223.8L246.7,227.8L242.1,227.8Z", cx:244.4, cy:225.8 },
  HN: { name:"Honduras", continent:"americas", path:"M241.6,227.5L258.4,227.5L258.4,231.9L241.6,231.9Z", cx:250.0, cy:229.7 },
  SV: { name:"El Salvador", continent:"americas", path:"M239.7,229.8L246.1,229.8L246.1,231.6L239.7,231.6Z", cx:242.9, cy:230.7 },
  NI: { name:"Nicaragua", continent:"americas", path:"M246.1,228.9L258.4,228.9L258.4,235.1L246.1,235.1Z", cx:252.3, cy:232.0 },
  CR: { name:"Costa Rica", continent:"americas", path:"M250.9,234.3L259.7,234.3L259.7,238.9L250.9,238.9Z", cx:255.3, cy:236.6 },
  PA: { name:"Panamá", continent:"americas", path:"M258.7,236.6L274.1,236.6L274.1,240.0L258.7,240.0Z", cx:266.4, cy:238.3 },
  CU: { name:"Cuba", continent:"americas", path:"M253.3,216.9L282.4,216.9L282.4,221.9L253.3,221.9Z", cx:267.9, cy:219.4 },
  HT: { name:"Haití", continent:"americas", path:"M281.3,221.8L289.1,221.8L289.1,224.6L281.3,224.6Z", cx:285.2, cy:223.2 },
  DO: { name:"Rep. Dominicana", continent:"americas", path:"M288.0,221.8L297.9,221.8L297.9,225.3L288.0,225.3Z", cx:292.9, cy:223.6 },
  PR: { name:"Puerto Rico", continent:"americas", path:"M300.5,223.8L305.1,223.8L305.1,224.7L300.5,224.7Z", cx:302.8, cy:224.3 },
  CO: { name:"Colombia", continent:"americas", path:"M269.3,232.6L301.6,232.6L301.6,255.8L269.3,255.8Z", cx:285.5, cy:244.3 },
  VE: { name:"Venezuela", continent:"americas", path:"M284.5,232.9L320.5,232.9L320.5,249.2L284.5,249.2Z", cx:302.5, cy:241.1 },
  GY: { name:"Guyana", continent:"americas", path:"M316.3,238.2L327.7,238.2L327.7,248.3L316.3,248.3Z", cx:322.0, cy:243.3 },
  SR: { name:"Surinam", continent:"americas", path:"M325.3,241.7L336.3,241.7L336.3,247.5L325.3,247.5Z", cx:330.8, cy:244.6 },
  GF: { name:"Guayana Francesa", continent:"americas", path:"M334.7,242.1L342.1,242.1L342.1,247.1L334.7,247.1Z", cx:338.4, cy:244.6 },
  BR: { name:"Brasil", continent:"americas", path:"M282.9,257.5L386.7,257.5L386.7,299.8L282.9,282.8Z", cx:334.8, cy:273.8 },
  EC: { name:"Ecuador", continent:"americas", path:"M264.5,248.1L279.7,248.1L279.7,257.0L264.5,257.0Z", cx:272.1, cy:252.5 },
  PE: { name:"Perú", continent:"americas", path:"M263.2,250.1L296.8,250.1L296.8,276.0L263.2,266.8Z", cx:280.0, cy:260.7 },
  BO: { name:"Bolivia", continent:"americas", path:"M294.4,263.5L326.7,263.5L326.7,282.7L294.4,282.7Z", cx:310.5, cy:273.0 },
  PY: { name:"Paraguay", continent:"americas", path:"M313.1,277.3L335.2,277.3L335.2,289.9L313.1,289.9Z", cx:324.1, cy:283.5 },
  AR: { name:"Argentina", continent:"americas", path:"M284.0,281.0L339.2,281.0L339.2,342.1L284.0,310.7Z", cx:311.6, cy:301.4 },
  CL: { name:"Chile", continent:"americas", path:"M278.4,274.7L302.9,274.7L302.9,344.1L278.4,318.2Z", cx:290.7, cy:299.8 },
  UY: { name:"Uruguay", continent:"americas", path:"M324.3,294.0L338.4,294.0L338.4,301.8L324.3,301.8Z", cx:331.3, cy:297.9 },
  AU: { name:"Australia", continent:"oceania", path:"M781.9,269.8L889.6,269.8L889.6,309.3L826.7,302.0L786.7,300.3L781.9,281.3Z", cx:826.0, cy:288.0 },
  NZ: { name:"Nueva Zelanda", continent:"oceania", path:"M923.7,300.9L956.3,300.9L956.3,324.7L923.7,324.7Z", cx:940.0, cy:312.3 },
  PG: { name:"Papúa Nueva Guinea", continent:"oceania", path:"M855.5,251.3L880.3,251.3L880.3,264.9L855.5,258.8Z", cx:867.9, cy:256.5 },
  FJ: { name:"Fiyi", continent:"oceania", path:"M952.3,272.5L960.0,272.5L960.0,279.2L952.3,279.2Z", cx:956.1, cy:275.9 },
  SB: { name:"Islas Salomón", continent:"oceania", path:"M894.7,259.2L913.9,259.2L913.9,266.6L894.7,266.6Z", cx:904.3, cy:262.9 },
  VU: { name:"Vanuatu", continent:"oceania", path:"M924.0,268.4L934.4,268.4L934.4,278.8L924.0,278.8Z", cx:929.2, cy:273.5 },
}

const CONTINENT_BASE_COLORS = {
  europe:   '#2a5298',
  asia:     '#8a5a1a',
  africa:   '#2d6a27',
  americas: '#7a2020',
  oceania:  '#4a2070',
}

const CONTINENT_LABELS = {
  europe: 'Europa', asia: 'Asia', africa: 'África',
  americas: 'Américas', oceania: 'Oceanía'
}

// ─── MAPA MUNDIAL ─────────────────────────────────────────────────────────────
function WorldMap({ ownership, leagueColors, selectedCode, onSelect, myLeagueId }) {
  const containerRef = useRef(null)
  const [tr, setTr] = useState({ k: 1, x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [lastDist, setLastDist] = useState(null)

  const zoom = (delta, cx, cy) =>
    setTr(t => {
      const k = Math.max(0.6, Math.min(8, t.k * delta))
      return { k, x: cx - (cx - t.x) * (k / t.k), y: cy - (cy - t.y) * (k / t.k) }
    })

  const handleWheel = (e) => {
    e.preventDefault()
    const r = containerRef.current.getBoundingClientRect()
    zoom(e.deltaY < 0 ? 1.2 : 0.83, e.clientX - r.left, e.clientY - r.top)
  }

  const onMD = (e) => {
    if (e.button !== 0) return
    setDragging(true)
    setDragStart({ x: e.clientX - tr.x, y: e.clientY - tr.y })
  }
  const onMM = (e) => { if (!dragging || !dragStart) return; setTr(t => ({ ...t, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })) }
  const onMU = () => { setDragging(false); setDragStart(null) }

  const onTS = (e) => {
    if (e.touches.length === 1) setDragStart({ x: e.touches[0].clientX - tr.x, y: e.touches[0].clientY - tr.y })
    else if (e.touches.length === 2) setLastDist(Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY))
  }
  const onTM = (e) => {
    e.preventDefault()
    if (e.touches.length === 1 && dragStart) setTr(t => ({ ...t, x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y }))
    else if (e.touches.length === 2 && lastDist) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
      const r = containerRef.current.getBoundingClientRect()
      zoom(d / lastDist, (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top)
      setLastDist(d)
    }
  }
  const onTE = () => { setDragStart(null); setLastDist(null) }

  useEffect(() => {
    const el = containerRef.current; if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    el.addEventListener('touchmove', onTM, { passive: false })
    return () => { el.removeEventListener('wheel', handleWheel); el.removeEventListener('touchmove', onTM) }
  }, [tr, dragging, dragStart, lastDist])

  const getFill = (code) => {
    const own = ownership[code]
    if (!own) return (CONTINENT_BASE_COLORS[WORLD_COUNTRIES[code]?.continent] || '#333') + 'cc'
    return leagueColors[own.league_id] || '#888'
  }

  return (
    <div ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height: '55vh', background: 'radial-gradient(ellipse at 50% 55%, #0a1e3d 0%, #030810 100%)', borderRadius: 20, cursor: dragging ? 'grabbing' : 'grab' }}
      onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
      onTouchStart={onTS} onTouchEnd={onTE}>

      {/* Fondo oceánico con grid sutil */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.06]" viewBox="0 0 960 500" preserveAspectRatio="none">
        <defs>
          <pattern id="grid" width="48" height="24" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 24" fill="none" stroke="#60a5fa" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="960" height="500" fill="url(#grid)" />
      </svg>

      {/* SVG mapa */}
      <svg viewBox="0 0 960 500" className="absolute inset-0 w-full h-full"
        style={{ transform: `translate(${tr.x}px,${tr.y}px) scale(${tr.k})`, transformOrigin: '0 0', willChange: 'transform' }}>
        <defs>
          <filter id="cshadow">
            <feDropShadow dx="0.5" dy="1.5" stdDeviation="1.5" floodColor="rgba(0,0,0,0.6)" />
          </filter>
        </defs>

        {/* Renderizar países */}
        {Object.entries(WORLD_COUNTRIES).map(([code, data]) => {
          const fill = getFill(code)
          const own = ownership[code]
          const isSelected = code === selectedCode
          const isMyTerr = own?.league_id === myLeagueId
          const isOwned = !!own
          return (
            <g key={code} onClick={e => { e.stopPropagation(); onSelect(code) }} style={{ cursor: 'pointer' }}>
              {/* Path principal */}
              <path
                d={data.path}
                fill={fill}
                stroke={isSelected ? '#ffffff' : isMyTerr ? '#f59e0b' : 'rgba(0,0,0,0.5)'}
                strokeWidth={isSelected ? 1.5/tr.k : isMyTerr ? 1/tr.k : 0.5/tr.k}
                strokeLinejoin="round"
                filter="url(#cshadow)"
                style={{
                  transition: 'fill 0.4s',
                  filter: isSelected
                    ? 'brightness(1.6) drop-shadow(0 0 4px rgba(255,255,255,0.7))'
                    : isMyTerr ? 'brightness(1.25)' : isOwned ? 'brightness(1.1)' : 'none'
                }}
              />
              {/* Highlight cartoon */}
              {isOwned && (
                <path d={data.path} fill="rgba(255,255,255,0.1)" stroke="none" style={{ pointerEvents: 'none' }} />
              )}
              {/* Label país (solo con zoom) */}
              {tr.k > 2 && (
                <text x={data.cx} y={data.cy} textAnchor="middle" dominantBaseline="middle"
                  fontSize={8/tr.k} fontWeight="800" fontFamily="system-ui,sans-serif"
                  fill={isOwned ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>{code}</text>
              )}
              {/* Estrella capital */}
              {own?.is_capital && tr.k > 1.5 && (
                <text x={data.cx} y={data.cy - 7/tr.k} textAnchor="middle"
                  fontSize={7/tr.k} fill="#FFD700" style={{ pointerEvents: 'none', userSelect: 'none' }}>★</text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Controles zoom */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-20">
        {[{l:'+',a:()=>zoom(1.3,480,250)},{l:'⊙',a:()=>setTr({k:1,x:0,y:0})},{l:'−',a:()=>zoom(0.77,480,250)}].map(({l,a})=>(
          <motion.button key={l} whileTap={{scale:0.88}} onClick={a}
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm"
            style={{backgroundColor:'rgba(5,13,26,0.85)',color:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.1)',backdropFilter:'blur(8px)'}}>
            {l}
          </motion.button>
        ))}
      </div>

      {/* Leyenda continentes */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-1">
        {Object.entries(CONTINENT_BASE_COLORS).map(([c,col])=>(
          <div key={c} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm opacity-80" style={{backgroundColor:col}} />
            <span className="text-xs font-medium capitalize" style={{color:'rgba(255,255,255,0.35)',fontSize:10}}>{CONTINENT_LABELS[c]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── PANEL PROVINCIA ──────────────────────────────────────────────────────────
function ProvincePanel({ code, ownership, leagueColors, leagueNames, myLeagueId, onClose, onClaim, canAct }) {
  const data = WORLD_COUNTRIES[code]
  if (!data) return null
  const own = ownership[code]
  const ownerColor = own ? (leagueColors[own.league_id] || '#888') : null
  const ownerName = own ? (leagueNames[own.league_id] || '?') : null
  const isNeutral = !own
  const isMyTerr = own?.league_id === myLeagueId
  const contColor = CONTINENT_BASE_COLORS[data.continent]

  return (
    <motion.div key={code}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
      transition={{ type: 'spring', stiffness: 420, damping: 35 }}
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: '#0a1628', border: `1.5px solid ${ownerColor || 'rgba(255,255,255,0.07)'}` }}>

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ background: (ownerColor || contColor) + '18', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <p className="font-black text-white text-base">{data.name}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {CONTINENT_LABELS[data.continent]} · {code}
          </p>
        </div>
        <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
          className="w-8 h-8 rounded-xl flex items-center justify-center ml-3 flex-shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>✕</motion.button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Estado */}
        <div className="flex items-center gap-2">
          {isNeutral
            ? <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: contColor + '22', color: contColor }}>🌍 Neutral</span>
            : isMyTerr
              ? <span className="text-xs font-black px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>⭐ Tu territorio</span>
              : <span className="text-xs font-black px-3 py-1 rounded-full" style={{ backgroundColor: ownerColor + '22', color: ownerColor }}>👑 {ownerName}</span>
          }
          {own?.soldiers > 0 && (
            <span className="text-xs px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
              ⚔️ {own.soldiers.toLocaleString()}
            </span>
          )}
        </div>

        {/* Botón acción */}
        {isNeutral && myLeagueId && (
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => onClaim(code)} disabled={!canAct}
            className="w-full py-3 rounded-xl font-black text-sm relative overflow-hidden"
            style={{ background: canAct ? 'linear-gradient(135deg,#1e40af,#3b82f6)' : 'rgba(255,255,255,0.04)', color: canAct ? '#fff' : 'rgba(255,255,255,0.25)' }}>
            {canAct && (
              <motion.div className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)' }}
                animate={{ x: ['-100%','200%'] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }} />
            )}
            <span className="relative">{canAct ? '🏴 Reclamar territorio' : '⏳ Sin acciones disponibles'}</span>
          </motion.button>
        )}
        {!isNeutral && !isMyTerr && myLeagueId && (
          <motion.button whileTap={{ scale: 0.96 }} disabled={!canAct}
            className="w-full py-3 rounded-xl font-black text-sm"
            style={{ background: canAct ? 'linear-gradient(135deg,#7f1d1d,#dc2626)' : 'rgba(255,255,255,0.04)', color: canAct ? '#fff' : 'rgba(255,255,255,0.25)' }}>
            ⚔️ Atacar — Fase 2
          </motion.button>
        )}
        {isMyTerr && (
          <div className="grid grid-cols-2 gap-2">
            <div className="py-2.5 rounded-xl text-center" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Reclutar</p>
              <p className="text-sm font-black text-amber-400">Fase 2</p>
            </div>
            <div className="py-2.5 rounded-xl text-center" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Construir</p>
              <p className="text-sm font-black text-amber-400">Fase 3</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function WarlordMode() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [gameData, setGameData] = useState(null)
  const [ownership, setOwnership] = useState({})
  const [participants, setParticipants] = useState([])
  const [myLeagues, setMyLeagues] = useState([])
  const [myParticipant, setMyParticipant] = useState(null)
  const [selectedCode, setSelectedCode] = useState(null)
  const [joining, setJoining] = useState(false)
  const [actionsLeft, setActionsLeft] = useState(5)
  const [nextReset, setNextReset] = useState(null)
  const [tab, setTab] = useState('map')
  const [showJoin, setShowJoin] = useState(false)

  const leagueColors = Object.fromEntries(participants.map(p => [p.league_id, p.color]))
  const leagueNames  = Object.fromEntries(participants.map(p => [p.league_id, p.leagues?.name || `Liga ${p.league_id}`]))
  const myLeagueId   = myParticipant?.league_id

  // Countdown acciones
  const [, forceRender] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      if (nextReset && new Date(nextReset) <= Date.now()) { setActionsLeft(5); setNextReset(null) }
      forceRender(n => n + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [nextReset])

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    if (!gameData?.id) return
    const ch = supabase.channel('warlord_rt_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warlord_ownership' }, () => fetchOwnership(gameData.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warlord_participants' }, () => fetchParticipants(gameData.id))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [gameData?.id])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: game }, { data: myLgs }] = await Promise.all([
      supabase.from('warlord_games').select('*').eq('status','active').order('id',{ascending:false}).limit(1).single(),
      supabase.from('league_members').select('league_id, leagues(id,name)').eq('user_id', user.id),
    ])
    const leagues = (myLgs || []).map(m => m.leagues).filter(Boolean)
    setMyLeagues(leagues)
    if (game) {
      setGameData(game)
      const [parts] = await Promise.all([fetchParticipants(game.id, leagues), fetchOwnership(game.id)])
    }
    setLoading(false)
  }

  const fetchParticipants = async (gameId, leagues) => {
    const { data } = await supabase.from('warlord_participants').select('*, leagues(name)').eq('game_id', gameId)
    setParticipants(data || [])
    const lgs = leagues || myLeagues
    const myIds = lgs.map(l => l?.id).filter(Boolean)
    setMyParticipant((data || []).find(p => myIds.includes(p.league_id)) || null)
    return data
  }

  const fetchOwnership = async (gameId) => {
    const { data } = await supabase.from('warlord_ownership').select('*, warlord_provinces(code)').eq('game_id', gameId)
    const map = {}
    ;(data || []).forEach(o => { if (o.warlord_provinces?.code) map[o.warlord_provinces.code] = { league_id: o.league_id, soldiers: o.soldiers, is_capital: o.is_capital } })
    setOwnership(map)
  }

  const handleJoin = async (leagueId) => {
    setJoining(true)
    const { data } = await supabase.rpc('join_warlord_game', { p_league_id: leagueId })
    if (data?.success) { await fetchAll(); setShowJoin(false) }
    setJoining(false)
  }

  const handleClaim = async (code) => {
    if (!myLeagueId || !gameData || actionsLeft <= 0) return
    const { data: prov } = await supabase.from('warlord_provinces').select('id').eq('code', code).single()
    if (!prov) return
    const { error } = await supabase.from('warlord_ownership').insert({
      game_id: gameData.id, province_id: prov.id, league_id: myLeagueId, soldiers: 100,
    })
    if (!error) {
      const newLeft = actionsLeft - 1
      setActionsLeft(newLeft)
      if (newLeft === 4) setNextReset(new Date(Date.now() + 30 * 60 * 1000).toISOString())
      setSelectedCode(null)
      fetchOwnership(gameData.id)
    }
  }

  const totalCountries = Object.keys(WORLD_COUNTRIES).length
  const totalOwned = Object.keys(ownership).length

  const rankingData = [...participants].map(p => ({
    ...p,
    territories: Object.values(ownership).filter(o => o.league_id === p.league_id).length,
    soldiers: Object.values(ownership).filter(o => o.league_id === p.league_id).reduce((s, o) => s + (o.soldiers || 0), 0),
  })).sort((a, b) => b.territories - a.territories)

  const cdStr = () => {
    if (!nextReset) return null
    const d = Math.max(0, new Date(nextReset) - Date.now())
    return `${String(Math.floor(d/60000)).padStart(2,'0')}:${String(Math.floor((d%60000)/1000)).padStart(2,'0')}`
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at 50% 40%, #0a1e3d, #030810)' }}>
      <div className="text-center">
        <motion.div className="text-6xl mb-4" animate={{ rotate: [0,8,-8,0], scale: [1,1.08,1] }} transition={{ duration: 2.5, repeat: Infinity }}>🌍</motion.div>
        <p className="font-black text-white text-lg tracking-wide">Cargando el mundo</p>
        <div className="flex justify-center gap-1 mt-3">
          {[0,1,2].map(i => (
            <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400"
              animate={{ opacity: [0.3,1,0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(180deg,#08142a 0%,#050d1a 100%)', color: '#fff' }}>

      {/* ── HEADER ── */}
      <div className="relative px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Glow fondo header */}
        <div className="absolute top-0 left-0 right-0 h-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 30% 0%, rgba(37,99,235,0.12) 0%, transparent 70%)' }} />

        <div className="relative flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <span className="text-xs">⚔️</span>
                <span className="text-xs font-black tracking-widest text-red-400">WARLORD</span>
              </div>
              <motion.div animate={{ opacity: [1,0.3,1] }} transition={{ duration: 1.5, repeat: Infinity }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs font-black text-emerald-400">LIVE</span>
              </motion.div>
            </div>
            <h1 className="text-2xl font-black leading-none">Conquista Global</h1>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {totalOwned} de {totalCountries} países conquistados
            </p>
          </div>

          {myLeagueId ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ backgroundColor: leagueColors[myLeagueId] + '20', border: `1px solid ${leagueColors[myLeagueId]}40` }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: leagueColors[myLeagueId] }} />
                <span className="text-xs font-bold truncate max-w-24" style={{ color: leagueColors[myLeagueId] }}>
                  {leagueNames[myLeagueId]}
                </span>
              </div>
              <p className="font-black text-2xl" style={{ color: leagueColors[myLeagueId] }}>
                {Object.values(ownership).filter(o => o.league_id === myLeagueId).length}
                <span className="text-sm font-medium ml-1" style={{ color: 'rgba(255,255,255,0.3)' }}>🏴</span>
              </p>
            </div>
          ) : (
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowJoin(true)}
              className="px-4 py-2.5 rounded-xl font-black text-sm"
              style={{ background: 'linear-gradient(135deg,#d97706,#f59e0b)', color: '#000' }}>
              ⚔️ Unirse
            </motion.button>
          )}
        </div>

        {/* Tabs */}
        <div className="relative flex gap-1 p-1 rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {[{id:'map',icon:'🗺️',label:'Mapa'},{id:'ranking',icon:'🏆',label:'Ranking'},{id:'info',icon:'ℹ️',label:'Info'}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="relative flex-1 py-2.5 rounded-xl text-xs font-black z-10 flex items-center justify-center gap-1.5"
              style={{ color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.35)' }}>
              {tab === t.id && (
                <motion.div layoutId="wt" className="absolute inset-0 rounded-xl"
                  style={{ background: 'linear-gradient(135deg,#1e3a6e,#2563eb)', zIndex: -1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── MAPA ── */}
      {tab === 'map' && (
        <div className="px-3 pt-3">

          {/* Banner sin liga */}
          {!myLeagueId && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-4 mb-3 flex items-center gap-3"
              style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.1),rgba(245,158,11,0.04))', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div className="text-3xl">⚔️</div>
              <div className="flex-1">
                <p className="font-black text-sm text-amber-400">¡Lleva tu liga a la conquista!</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Únete y reclamad territorios para tu liga</p>
              </div>
              <motion.button whileTap={{ scale: 0.94 }} onClick={() => setShowJoin(true)}
                className="px-3 py-2 rounded-xl font-black text-xs flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#d97706,#f59e0b)', color: '#000' }}>
                Unirse
              </motion.button>
            </motion.div>
          )}

          {/* Barra acciones */}
          {myLeagueId && (
            <div className="rounded-2xl p-3.5 mb-3 flex items-center gap-4"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex-1">
                <p className="text-xs font-black mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>ACCIONES DISPONIBLES</p>
                <div className="flex gap-1.5">
                  {Array.from({length:5}).map((_,i) => (
                    <motion.div key={i} className="flex-1 h-2.5 rounded-full"
                      style={{ backgroundColor: i < actionsLeft ? '#3b82f6' : 'rgba(255,255,255,0.06)' }}
                      animate={i < actionsLeft ? { opacity: [0.7,1,0.7] } : {}}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }} />
                  ))}
                </div>
              </div>
              {cdStr() && (
                <div className="text-right flex-shrink-0">
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Recarga en</p>
                  <p className="font-black text-blue-400">{cdStr()}</p>
                </div>
              )}
              {!cdStr() && (
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-2xl text-blue-400">{actionsLeft}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>de 5</p>
                </div>
              )}
            </div>
          )}

          {/* Chips participantes */}
          {participants.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
              {rankingData.map(p => (
                <div key={p.league_id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl flex-shrink-0"
                  style={{ background: p.color + '14', border: `1px solid ${p.color}30` }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-xs font-black" style={{ color: p.color }}>{p.leagues?.name}</span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{p.territories}🏴</span>
                </div>
              ))}
            </div>
          )}

          {/* MAPA */}
          <WorldMap
            ownership={ownership}
            leagueColors={leagueColors}
            selectedCode={selectedCode}
            onSelect={code => setSelectedCode(prev => prev === code ? null : code)}
            myLeagueId={myLeagueId}
          />

          <p className="text-center mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
            Rueda/pinza para zoom · arrastra · pulsa un país
          </p>

          {/* Panel provincia */}
          <AnimatePresence>
            {selectedCode && (
              <div className="mt-3">
                <ProvincePanel
                  code={selectedCode}
                  ownership={ownership}
                  leagueColors={leagueColors}
                  leagueNames={leagueNames}
                  myLeagueId={myLeagueId}
                  onClose={() => setSelectedCode(null)}
                  onClaim={handleClaim}
                  canAct={actionsLeft > 0}
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── RANKING ── */}
      {tab === 'ranking' && (
        <div className="px-4 pt-4 pb-6">
          {rankingData.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.25)' }}>
              <div className="text-5xl mb-3">🌍</div>
              <p className="font-medium">Ninguna liga en combate todavía</p>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.15)' }}>Sé el primero en conquistar el mundo</p>
            </div>
          ) : (
            <>
              {/* Podio */}
              {rankingData.length >= 3 && (
                <div className="flex items-end justify-center gap-3 mb-6 pt-2">
                  {[rankingData[1],rankingData[0],rankingData[2]].map((p,i) => {
                    const hs = [75,100,60], ms = ['🥈','🥇','🥉']
                    return (
                      <motion.div key={p.league_id} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*0.1}}
                        className="flex flex-col items-center gap-1.5 flex-1">
                        <span className="text-2xl">{ms[i]}</span>
                        <div className="w-3 h-3 rounded-full" style={{backgroundColor:p.color}} />
                        <p className="text-xs font-black text-center truncate w-full px-1" style={{color:p.color}}>{p.leagues?.name}</p>
                        <div className="w-full rounded-t-2xl flex items-center justify-center"
                          style={{height:hs[i],backgroundColor:p.color+'18',border:`1px solid ${p.color}35`}}>
                          <div className="text-center">
                            <p className="font-black text-xl" style={{color:p.color}}>{p.territories}</p>
                            <p className="text-xs" style={{color:'rgba(255,255,255,0.3)'}}>países</p>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}

              {/* Lista */}
              <div className="space-y-2">
                {rankingData.map((p,idx) => {
                  const isMe = p.league_id === myLeagueId
                  return (
                    <motion.div key={p.league_id}
                      initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:idx*0.04}}
                      className="rounded-2xl p-3.5 flex items-center gap-3"
                      style={{background:isMe?p.color+'0e':'rgba(255,255,255,0.03)',border:`1px solid ${isMe?p.color+'35':'rgba(255,255,255,0.05)'}`}}>
                      <span className="text-sm w-6 text-center" style={{color:'rgba(255,255,255,0.3)'}}>
                        {idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':`#${idx+1}`}
                      </span>
                      <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{backgroundColor:p.color}} />
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm truncate" style={{color:isMe?p.color:'#fff'}}>
                          {p.leagues?.name}{isMe?' ★':''}
                        </p>
                        <p className="text-xs" style={{color:'rgba(255,255,255,0.3)'}}>⚔️ {p.soldiers.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black" style={{color:p.color}}>{p.territories}</p>
                        <p className="text-xs" style={{color:'rgba(255,255,255,0.25)'}}>países</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── INFO ── */}
      {tab === 'info' && (
        <div className="px-4 pt-4 pb-6 space-y-3">
          {[
            {title:'🌍 Objetivo',items:['Conquistar el mayor número de países posible.','Los neutrales se reclaman con acciones (5 cada 30 min).','Los rivales se atacan — combate automático en Fase 2.']},
            {title:'⚔️ Soldados',items:['Los puntos de liga se convierten en soldados iniciales.','Cada consumición aporta tropas al ejército.','Recluta de la población local de cada provincia.']},
            {title:'🏰 Economía — Fase 3',items:['Construye granjas, cuarteles, mercados y murallas.','Explotad los recursos únicos de cada territorio.','Comerciad o declarad guerras económicas a otras ligas.']},
            {title:'🤝 Diplomacia — Fase 4',items:['Tratados de paz y alianzas entre ligas.','Formas de gobierno que modifican stats (democracia, monarquía, dictadura).','Eventos globales: plagas, bonanzas, erupciones.']},
          ].map(s => (
            <div key={s.title} className="rounded-2xl p-4"
              style={{backgroundColor:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
              <p className="font-black text-sm text-amber-400 mb-3">{s.title}</p>
              <div className="space-y-2">
                {s.items.map((item,i) => (
                  <div key={i} className="flex gap-2.5">
                    <div className="w-1 h-1 rounded-full flex-shrink-0 mt-2" style={{backgroundColor:'rgba(245,158,11,0.5)'}} />
                    <p className="text-xs leading-relaxed" style={{color:'rgba(255,255,255,0.45)'}}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Stats globales */}
          <div className="rounded-2xl p-4"
            style={{background:'linear-gradient(135deg,rgba(37,99,235,0.1),rgba(37,99,235,0.04))',border:'1px solid rgba(37,99,235,0.18)'}}>
            <p className="font-black text-sm text-blue-400 mb-3">📊 Estado del mundo</p>
            <div className="grid grid-cols-3 gap-2">
              {[{l:'Países',v:totalCountries,c:'#fff'},{l:'Conquistados',v:totalOwned,c:'#f59e0b'},{l:'Neutrales',v:totalCountries-totalOwned,c:'#60a5fa'}].map(s=>(
                <div key={s.l} className="text-center rounded-xl py-3" style={{backgroundColor:'rgba(255,255,255,0.04)'}}>
                  <p className="font-black text-xl" style={{color:s.c}}>{s.v}</p>
                  <p className="text-xs mt-0.5" style={{color:'rgba(255,255,255,0.3)'}}>{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL UNIRSE ── */}
      <AnimatePresence>
        {showJoin && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{backgroundColor:'rgba(0,0,0,0.85)'}}
            onClick={() => setShowJoin(false)}>
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
              transition={{type:'spring',stiffness:400,damping:40}}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl p-6"
              style={{backgroundColor:'#0a1628',border:'1px solid rgba(255,255,255,0.07)'}}>
              <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{backgroundColor:'rgba(255,255,255,0.12)'}} />
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">🌍</div>
                <h2 className="font-black text-xl">Elige tu liga</h2>
                <p className="text-sm mt-1" style={{color:'rgba(255,255,255,0.4)'}}>¿Con qué liga vas a conquistar el mundo?</p>
              </div>
              <div className="space-y-2 mb-4">
                {myLeagues.map(lg => (
                  <motion.button key={lg.id} whileTap={{scale:0.97}}
                    onClick={() => handleJoin(lg.id)} disabled={joining}
                    className="w-full p-4 rounded-2xl flex items-center gap-3 text-left"
                    style={{background:'linear-gradient(135deg,rgba(37,99,235,0.15),rgba(37,99,235,0.05))',border:'1px solid rgba(37,99,235,0.2)'}}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{backgroundColor:'rgba(37,99,235,0.15)'}}>⚔️</div>
                    <div className="flex-1">
                      <p className="font-black text-sm">{lg.name}</p>
                      <p className="text-xs mt-0.5" style={{color:'rgba(255,255,255,0.35)'}}>
                        {joining ? 'Uniéndose...' : 'Pulsa para entrar en la partida'}
                      </p>
                    </div>
                    <span className="text-blue-400">→</span>
                  </motion.button>
                ))}
                {myLeagues.length === 0 && (
                  <p className="text-center text-sm py-4" style={{color:'rgba(255,255,255,0.35)'}}>
                    Únete a una liga desde la sección 🏆 primero
                  </p>
                )}
              </div>
              <motion.button whileTap={{scale:0.97}} onClick={() => setShowJoin(false)}
                className="w-full py-3 rounded-xl text-sm font-bold"
                style={{backgroundColor:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.35)'}}>
                Cancelar
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}