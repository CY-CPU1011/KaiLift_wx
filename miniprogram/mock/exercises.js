// mock/exercises.js —— 动作库离线兜底（源自 KaiLift/prisma/data/system-exercises.json，50 条）
// 由脚本生成（id 取 externalKey），保证 mock 模式「列表→详情/历史」按 id 跳转可用；
// 切真实接口（id 为 cuid）时同一套页面逻辑无缝替换。新用户无 PR/历史，history 兜底为空。
// 字段与 GET /exercises 详情对齐；列表卡片只取其子集（name/bodyPart/primaryMuscles/level…）。

const items = [
  {
    "id": "barbell-bench-press",
    "name": "杠铃卧推",
    "aliases": [
      "卧推",
      "平板卧推",
      "bench press"
    ],
    "bodyPart": "胸",
    "equipment": "杠铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "中级",
    "primaryMuscles": [
      "胸"
    ],
    "secondaryMuscles": [
      "三头",
      "肩"
    ],
    "instructions": [
      "仰卧平凳，双脚踩实，双手略宽于肩握住杠铃。",
      "出杠后控制下放至触碰胸部中下沿，肘部约 45 度。",
      "稳住底部后蹬地发力把杠铃推起至手臂伸直，重复。"
    ],
    "images": []
  },
  {
    "id": "dumbbell-bench-press",
    "name": "哑铃卧推",
    "aliases": [
      "哑铃平板卧推",
      "dumbbell bench press"
    ],
    "bodyPart": "胸",
    "equipment": "哑铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "中级",
    "primaryMuscles": [
      "胸"
    ],
    "secondaryMuscles": [
      "三头",
      "肩"
    ],
    "instructions": [
      "仰卧平凳，双手各持一只哑铃置于胸侧。",
      "向上推起至哑铃接近、手臂伸直。",
      "控制下放至胸部两侧充分拉伸，重复。"
    ],
    "images": []
  },
  {
    "id": "barbell-incline-bench-press",
    "name": "上斜杠铃卧推",
    "aliases": [
      "上斜卧推",
      "斜板卧推",
      "incline bench press"
    ],
    "bodyPart": "胸",
    "equipment": "杠铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "中级",
    "primaryMuscles": [
      "胸"
    ],
    "secondaryMuscles": [
      "肩",
      "三头"
    ],
    "instructions": [
      "坐于约 30 度上斜凳，略宽于肩握住杠铃。",
      "下放至触碰上胸，肘部保持稳定。",
      "推起至手臂伸直，重复。"
    ],
    "images": []
  },
  {
    "id": "incline-dumbbell-press",
    "name": "上斜哑铃卧推",
    "aliases": [
      "上斜哑铃推举",
      "incline dumbbell press"
    ],
    "bodyPart": "胸",
    "equipment": "哑铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "中级",
    "primaryMuscles": [
      "胸"
    ],
    "secondaryMuscles": [
      "肩",
      "三头"
    ],
    "instructions": [
      "坐于约 30 度上斜凳，双手各持哑铃置于上胸两侧。",
      "向上推起至手臂伸直。",
      "控制下放充分拉伸上胸，重复。"
    ],
    "images": []
  },
  {
    "id": "dumbbell-flyes",
    "name": "哑铃飞鸟",
    "aliases": [
      "飞鸟",
      "卧推飞鸟",
      "dumbbell flyes"
    ],
    "bodyPart": "胸",
    "equipment": "哑铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "推",
    "level": "中级",
    "primaryMuscles": [
      "胸"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "仰卧平凳，双手持哑铃于胸前，肘微屈固定。",
      "以画弧轨迹向两侧打开至胸部充分拉伸。",
      "用胸部收缩把哑铃合拢回起点，重复。"
    ],
    "images": []
  },
  {
    "id": "butterfly-machine",
    "name": "蝴蝶机夹胸",
    "aliases": [
      "夹胸",
      "蝴蝶机",
      "pec deck"
    ],
    "bodyPart": "胸",
    "equipment": "器械",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "推",
    "level": "初级",
    "primaryMuscles": [
      "胸"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "坐入器械，背贴靠垫，前臂贴住挡板。",
      "用胸部发力把两臂向中间合拢。",
      "控制还原至胸部拉伸，重复。"
    ],
    "images": []
  },
  {
    "id": "cable-crossover",
    "name": "绳索夹胸",
    "aliases": [
      "龙门架夹胸",
      "绳索飞鸟",
      "cable crossover"
    ],
    "bodyPart": "胸",
    "equipment": "绳索",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "推",
    "level": "中级",
    "primaryMuscles": [
      "胸"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "站于龙门架中间，双手各握高位手柄，身体略前倾。",
      "以画弧轨迹把手柄向身前下方合拢，胸部收紧。",
      "控制还原至胸部拉伸，重复。"
    ],
    "images": []
  },
  {
    "id": "chest-dips",
    "name": "双杠臂屈伸",
    "aliases": [
      "双杠臂屈伸",
      "臂屈伸",
      "dips"
    ],
    "bodyPart": "胸",
    "equipment": "自重",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "中级",
    "primaryMuscles": [
      "胸"
    ],
    "secondaryMuscles": [
      "三头",
      "肩"
    ],
    "instructions": [
      "双手撑双杠，身体略前倾以更多刺激胸部。",
      "屈肘下放至胸部有拉伸感。",
      "推起至手臂伸直，重复。"
    ],
    "images": []
  },
  {
    "id": "pushups",
    "name": "俯卧撑",
    "aliases": [
      "俯卧撑",
      "push up",
      "pushups"
    ],
    "bodyPart": "胸",
    "equipment": "自重",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "初级",
    "primaryMuscles": [
      "胸"
    ],
    "secondaryMuscles": [
      "三头",
      "肩",
      "腹肌"
    ],
    "instructions": [
      "俯撑，双手略宽于肩，身体保持一条直线。",
      "屈肘下放至胸部接近地面。",
      "推起至手臂伸直，全程收紧核心，重复。"
    ],
    "images": []
  },
  {
    "id": "barbell-deadlift",
    "name": "硬拉",
    "aliases": [
      "传统硬拉",
      "杠铃硬拉",
      "deadlift"
    ],
    "bodyPart": "背",
    "equipment": "杠铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "拉",
    "level": "高级",
    "primaryMuscles": [
      "下背"
    ],
    "secondaryMuscles": [
      "臀",
      "腘绳肌",
      "斜方肌"
    ],
    "instructions": [
      "双脚与髋同宽站于杠铃后，屈髋下蹲握杠。",
      "挺胸收背、核心收紧，伸髋伸膝把杠铃拉起站直。",
      "髋部主导控制下放回地面，重复。"
    ],
    "images": []
  },
  {
    "id": "romanian-deadlift",
    "name": "罗马尼亚硬拉",
    "aliases": [
      "RDL",
      "直腿硬拉",
      "罗马硬拉",
      "romanian deadlift"
    ],
    "bodyPart": "背",
    "equipment": "杠铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "拉",
    "level": "中级",
    "primaryMuscles": [
      "腘绳肌"
    ],
    "secondaryMuscles": [
      "臀",
      "下背"
    ],
    "instructions": [
      "站直握杠，膝盖微屈并保持固定角度。",
      "髋部向后推、杠铃贴腿下放至腘绳肌充分拉伸。",
      "伸髋把杠铃带回站直，全程背部挺直，重复。"
    ],
    "images": []
  },
  {
    "id": "pullups",
    "name": "引体向上",
    "aliases": [
      "引体",
      "pull up",
      "pullups"
    ],
    "bodyPart": "背",
    "equipment": "自重",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "拉",
    "level": "中级",
    "primaryMuscles": [
      "背阔肌"
    ],
    "secondaryMuscles": [
      "二头",
      "中背"
    ],
    "instructions": [
      "正握单杠略宽于肩，自然悬垂。",
      "用背阔肌发力把身体拉起至下巴过杠。",
      "控制下放回完全悬垂，重复。"
    ],
    "images": []
  },
  {
    "id": "lat-pulldown",
    "name": "高位下拉",
    "aliases": [
      "下拉",
      "高位下拉",
      "lat pulldown"
    ],
    "bodyPart": "背",
    "equipment": "器械",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "拉",
    "level": "初级",
    "primaryMuscles": [
      "背阔肌"
    ],
    "secondaryMuscles": [
      "二头",
      "中背"
    ],
    "instructions": [
      "坐入器械，腿垫固定大腿，略宽于肩握横杆。",
      "挺胸把横杆下拉至上胸位置，肩胛下沉。",
      "控制还原至手臂伸直，重复。"
    ],
    "images": []
  },
  {
    "id": "bent-over-barbell-row",
    "name": "杠铃俯身划船",
    "aliases": [
      "俯身划船",
      "杠铃划船",
      "barbell row"
    ],
    "bodyPart": "背",
    "equipment": "杠铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "拉",
    "level": "中级",
    "primaryMuscles": [
      "中背"
    ],
    "secondaryMuscles": [
      "背阔肌",
      "二头",
      "下背"
    ],
    "instructions": [
      "屈髋俯身约 45 度，背部挺直握杠垂于身前。",
      "把杠铃拉向上腹/下肋，肩胛后收。",
      "控制下放至手臂伸直，重复。"
    ],
    "images": []
  },
  {
    "id": "one-arm-dumbbell-row",
    "name": "单臂哑铃划船",
    "aliases": [
      "哑铃划船",
      "单臂划船",
      "dumbbell row"
    ],
    "bodyPart": "背",
    "equipment": "哑铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "拉",
    "level": "初级",
    "primaryMuscles": [
      "背阔肌"
    ],
    "secondaryMuscles": [
      "中背",
      "二头"
    ],
    "instructions": [
      "同侧手膝撑于平凳，另一手持哑铃自然下垂。",
      "把哑铃拉向髋侧，肘贴身、肩胛后收。",
      "控制下放充分拉伸背阔肌，换边，重复。"
    ],
    "images": []
  },
  {
    "id": "seated-cable-row",
    "name": "坐姿绳索划船",
    "aliases": [
      "坐姿划船",
      "绳索划船",
      "seated row"
    ],
    "bodyPart": "背",
    "equipment": "绳索",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "拉",
    "level": "初级",
    "primaryMuscles": [
      "中背"
    ],
    "secondaryMuscles": [
      "背阔肌",
      "二头"
    ],
    "instructions": [
      "坐姿踩稳踏板，膝微屈握住手柄，背部挺直。",
      "把手柄拉向腹部，肩胛后收。",
      "控制还原至背部充分伸展，重复。"
    ],
    "images": []
  },
  {
    "id": "t-bar-row",
    "name": "T 杠划船",
    "aliases": [
      "T杠划船",
      "t-bar row"
    ],
    "bodyPart": "背",
    "equipment": "杠铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "拉",
    "level": "中级",
    "primaryMuscles": [
      "中背"
    ],
    "secondaryMuscles": [
      "背阔肌",
      "二头"
    ],
    "instructions": [
      "跨站于 T 杠两侧，屈髋俯身、背部挺直握把。",
      "把重量拉向胸腹，肩胛后收。",
      "控制下放至手臂伸直，重复。"
    ],
    "images": []
  },
  {
    "id": "barbell-shrug",
    "name": "杠铃耸肩",
    "aliases": [
      "耸肩",
      "barbell shrug"
    ],
    "bodyPart": "背",
    "equipment": "杠铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "拉",
    "level": "初级",
    "primaryMuscles": [
      "斜方肌"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "站直双手握杠垂于身前。",
      "用斜方肌把双肩尽量上耸，顶端停顿。",
      "控制下放回起点，全程不借力摆动，重复。"
    ],
    "images": []
  },
  {
    "id": "hyperextension",
    "name": "山羊挺身",
    "aliases": [
      "背伸展",
      "罗马椅挺身",
      "hyperextension"
    ],
    "bodyPart": "背",
    "equipment": "自重",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "拉",
    "level": "初级",
    "primaryMuscles": [
      "下背"
    ],
    "secondaryMuscles": [
      "臀",
      "腘绳肌"
    ],
    "instructions": [
      "俯卧罗马椅，踝部固定，髋部位于垫沿。",
      "屈髋下放上半身，再用下背与臀发力挺身至躯干成直线。",
      "控制还原，不过度后仰，重复。"
    ],
    "images": []
  },
  {
    "id": "barbell-squat",
    "name": "杠铃深蹲",
    "aliases": [
      "深蹲",
      "背蹲",
      "back squat"
    ],
    "bodyPart": "腿",
    "equipment": "杠铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "中级",
    "primaryMuscles": [
      "股四头"
    ],
    "secondaryMuscles": [
      "臀",
      "腘绳肌"
    ],
    "instructions": [
      "杠铃置于斜方肌上沿，双脚与肩同宽站稳。",
      "屈髋屈膝下蹲至大腿与地面平行或更低。",
      "蹬地伸髋伸膝站起，全程核心收紧，重复。"
    ],
    "images": []
  },
  {
    "id": "goblet-squat",
    "name": "高脚杯深蹲",
    "aliases": [
      "高脚杯蹲",
      "哥布林深蹲",
      "goblet squat"
    ],
    "bodyPart": "腿",
    "equipment": "哑铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "初级",
    "primaryMuscles": [
      "股四头"
    ],
    "secondaryMuscles": [
      "臀"
    ],
    "instructions": [
      "双手竖捧一只哑铃于胸前。",
      "挺胸屈髋屈膝下蹲至大腿平行。",
      "蹬地站起，全程躯干直立，重复。"
    ],
    "images": []
  },
  {
    "id": "hack-squat",
    "name": "哈克深蹲",
    "aliases": [
      "哈克深蹲",
      "hack squat"
    ],
    "bodyPart": "腿",
    "equipment": "器械",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "中级",
    "primaryMuscles": [
      "股四头"
    ],
    "secondaryMuscles": [
      "臀"
    ],
    "instructions": [
      "背靠哈克机靠垫，肩抵肩垫，双脚踩稳踏板。",
      "解锁后屈膝下蹲至大腿平行。",
      "蹬踏板伸膝站起，膝盖对准脚尖，重复。"
    ],
    "images": []
  },
  {
    "id": "leg-press",
    "name": "腿举",
    "aliases": [
      "倒蹬",
      "腿举",
      "leg press"
    ],
    "bodyPart": "腿",
    "equipment": "器械",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "初级",
    "primaryMuscles": [
      "股四头"
    ],
    "secondaryMuscles": [
      "臀",
      "腘绳肌"
    ],
    "instructions": [
      "坐入腿举机，双脚与肩同宽踩稳踏板。",
      "解锁后屈膝把踏板下放至约 90 度。",
      "蹬起伸膝但不锁死，重复。"
    ],
    "images": []
  },
  {
    "id": "lunges",
    "name": "箭步蹲",
    "aliases": [
      "弓步蹲",
      "箭步蹲",
      "lunges"
    ],
    "bodyPart": "腿",
    "equipment": "哑铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "中级",
    "primaryMuscles": [
      "股四头"
    ],
    "secondaryMuscles": [
      "臀",
      "腘绳肌"
    ],
    "instructions": [
      "双手持哑铃站直，一脚向前迈出一大步。",
      "屈膝下蹲至后膝接近地面，前膝对准脚尖。",
      "前脚蹬地起身收回，换腿，重复。"
    ],
    "images": []
  },
  {
    "id": "bulgarian-split-squat",
    "name": "保加利亚分腿蹲",
    "aliases": [
      "保加利亚蹲",
      "后脚抬高分腿蹲",
      "bulgarian split squat"
    ],
    "bodyPart": "腿",
    "equipment": "哑铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "中级",
    "primaryMuscles": [
      "股四头"
    ],
    "secondaryMuscles": [
      "臀"
    ],
    "instructions": [
      "后脚脚背搭于身后平凳，前脚向前迈一步，双手持哑铃。",
      "屈前膝下蹲至大腿接近平行，重心压前脚。",
      "前脚蹬地起身，做完一侧再换边。"
    ],
    "images": []
  },
  {
    "id": "leg-extension",
    "name": "腿屈伸",
    "aliases": [
      "腿屈伸",
      "股四头伸展",
      "leg extension"
    ],
    "bodyPart": "腿",
    "equipment": "器械",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "推",
    "level": "初级",
    "primaryMuscles": [
      "股四头"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "坐入器械，踝部抵住挡杆，调整轴心对准膝关节。",
      "伸膝把小腿抬起至接近伸直，顶端收紧股四头。",
      "控制还原，重复。"
    ],
    "images": []
  },
  {
    "id": "lying-leg-curl",
    "name": "俯卧腿弯举",
    "aliases": [
      "腿弯举",
      "俯卧腿弯举",
      "leg curl"
    ],
    "bodyPart": "腿",
    "equipment": "器械",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "拉",
    "level": "初级",
    "primaryMuscles": [
      "腘绳肌"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "俯卧器械，踝部抵住挡杆。",
      "屈膝把挡杆勾向臀部，顶端收紧腘绳肌。",
      "控制还原至腿接近伸直，重复。"
    ],
    "images": []
  },
  {
    "id": "standing-calf-raise",
    "name": "站姿提踵",
    "aliases": [
      "提踵",
      "站姿提踵",
      "calf raise"
    ],
    "bodyPart": "腿",
    "equipment": "器械",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "推",
    "level": "初级",
    "primaryMuscles": [
      "小腿"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "前脚掌踩于踏板边缘，肩抵肩垫站直。",
      "尽量踮起脚跟至小腿顶端收紧。",
      "控制下放至脚跟低于踏板充分拉伸，重复。"
    ],
    "images": []
  },
  {
    "id": "seated-calf-raise",
    "name": "坐姿提踵",
    "aliases": [
      "坐姿提踵",
      "seated calf raise"
    ],
    "bodyPart": "腿",
    "equipment": "器械",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "推",
    "level": "初级",
    "primaryMuscles": [
      "小腿"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "坐姿，前脚掌踩踏板，膝垫压住大腿。",
      "踮起脚跟至小腿顶端收紧。",
      "控制下放充分拉伸，重复。"
    ],
    "images": []
  },
  {
    "id": "standing-military-press",
    "name": "杠铃站姿推举",
    "aliases": [
      "站姿推举",
      "杠铃过头推",
      "overhead press",
      "military press"
    ],
    "bodyPart": "肩",
    "equipment": "杠铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "中级",
    "primaryMuscles": [
      "肩"
    ],
    "secondaryMuscles": [
      "三头",
      "斜方肌"
    ],
    "instructions": [
      "站直，杠铃置于锁骨前沿，略宽于肩握杠。",
      "收紧核心把杠铃竖直推过头顶至手臂伸直。",
      "控制下放回锁骨前，重复。"
    ],
    "images": []
  },
  {
    "id": "dumbbell-shoulder-press",
    "name": "哑铃肩上推举",
    "aliases": [
      "哑铃推举",
      "坐姿哑铃推举",
      "dumbbell shoulder press"
    ],
    "bodyPart": "肩",
    "equipment": "哑铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "初级",
    "primaryMuscles": [
      "肩"
    ],
    "secondaryMuscles": [
      "三头"
    ],
    "instructions": [
      "坐姿背靠靠垫，双手持哑铃举于耳侧。",
      "向上推起至手臂接近伸直。",
      "控制下放回耳侧，重复。"
    ],
    "images": []
  },
  {
    "id": "arnold-press",
    "name": "阿诺德推举",
    "aliases": [
      "阿诺德推举",
      "arnold press"
    ],
    "bodyPart": "肩",
    "equipment": "哑铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "中级",
    "primaryMuscles": [
      "肩"
    ],
    "secondaryMuscles": [
      "三头"
    ],
    "instructions": [
      "坐姿持哑铃于胸前、掌心朝向自己。",
      "推起的同时旋转手腕至掌心朝前、手臂伸直过头。",
      "反向旋转控制下放回起点，重复。"
    ],
    "images": []
  },
  {
    "id": "side-lateral-raise",
    "name": "哑铃侧平举",
    "aliases": [
      "侧平举",
      "哑铃侧平举",
      "lateral raise"
    ],
    "bodyPart": "肩",
    "equipment": "哑铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "拉",
    "level": "初级",
    "primaryMuscles": [
      "肩"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "站直双手各持哑铃垂于体侧，肘微屈。",
      "以肩为轴把哑铃向两侧抬起至与肩同高。",
      "控制下放回体侧，不借力摆动，重复。"
    ],
    "images": []
  },
  {
    "id": "front-dumbbell-raise",
    "name": "哑铃前平举",
    "aliases": [
      "前平举",
      "哑铃前平举",
      "front raise"
    ],
    "bodyPart": "肩",
    "equipment": "哑铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "推",
    "level": "初级",
    "primaryMuscles": [
      "肩"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "站直双手持哑铃置于大腿前侧，肘微屈。",
      "把哑铃向前方抬起至与肩同高。",
      "控制下放回起点，重复。"
    ],
    "images": []
  },
  {
    "id": "reverse-flyes",
    "name": "反向飞鸟",
    "aliases": [
      "后束飞鸟",
      "俯身飞鸟",
      "reverse flyes"
    ],
    "bodyPart": "肩",
    "equipment": "哑铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "拉",
    "level": "中级",
    "primaryMuscles": [
      "肩"
    ],
    "secondaryMuscles": [
      "中背"
    ],
    "instructions": [
      "屈髋俯身，双手持哑铃自然下垂，肘微屈。",
      "用后束与肩胛把哑铃向两侧打开至与肩同高。",
      "控制还原，不耸肩借力，重复。"
    ],
    "images": []
  },
  {
    "id": "face-pull",
    "name": "面拉",
    "aliases": [
      "面拉",
      "绳索面拉",
      "face pull"
    ],
    "bodyPart": "肩",
    "equipment": "绳索",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "拉",
    "level": "中级",
    "primaryMuscles": [
      "肩"
    ],
    "secondaryMuscles": [
      "斜方肌",
      "中背"
    ],
    "instructions": [
      "绳索调至上胸/面部高度，双手对握绳头。",
      "把绳头拉向面部两侧、肘高于手，肩胛后收。",
      "控制还原，重复。"
    ],
    "images": []
  },
  {
    "id": "upright-barbell-row",
    "name": "杠铃直立划船",
    "aliases": [
      "直立划船",
      "杠铃直立划船",
      "upright row"
    ],
    "bodyPart": "肩",
    "equipment": "杠铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "拉",
    "level": "中级",
    "primaryMuscles": [
      "肩"
    ],
    "secondaryMuscles": [
      "斜方肌"
    ],
    "instructions": [
      "站直握杠垂于身前，握距略窄于肩。",
      "沿身体把杠铃上提至上胸，肘高于手腕。",
      "控制下放回起点，重复。"
    ],
    "images": []
  },
  {
    "id": "barbell-curl",
    "name": "杠铃弯举",
    "aliases": [
      "弯举",
      "杠铃弯举",
      "barbell curl"
    ],
    "bodyPart": "臂",
    "equipment": "杠铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "拉",
    "level": "中级",
    "primaryMuscles": [
      "二头"
    ],
    "secondaryMuscles": [
      "前臂"
    ],
    "instructions": [
      "站直与肩同宽握杠垂于身前，肘贴身固定。",
      "屈肘把杠铃弯举至顶端收紧二头。",
      "控制下放至手臂伸直，不摆动借力，重复。"
    ],
    "images": []
  },
  {
    "id": "dumbbell-alternate-curl",
    "name": "哑铃交替弯举",
    "aliases": [
      "交替弯举",
      "哑铃弯举",
      "dumbbell curl"
    ],
    "bodyPart": "臂",
    "equipment": "哑铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "拉",
    "level": "初级",
    "primaryMuscles": [
      "二头"
    ],
    "secondaryMuscles": [
      "前臂"
    ],
    "instructions": [
      "站直双手各持哑铃垂于体侧，肘贴身。",
      "交替屈肘把一侧哑铃弯举至顶端收紧。",
      "控制下放，换另一侧，重复。"
    ],
    "images": []
  },
  {
    "id": "hammer-curl",
    "name": "锤式弯举",
    "aliases": [
      "锤式弯举",
      "中立握弯举",
      "hammer curl"
    ],
    "bodyPart": "臂",
    "equipment": "哑铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "拉",
    "level": "初级",
    "primaryMuscles": [
      "二头"
    ],
    "secondaryMuscles": [
      "前臂"
    ],
    "instructions": [
      "站直双手各持哑铃、掌心相对（中立握）。",
      "保持中立握屈肘弯举至顶端。",
      "控制下放，重复。"
    ],
    "images": []
  },
  {
    "id": "preacher-curl",
    "name": "牧师凳弯举",
    "aliases": [
      "牧师凳弯举",
      "斜托弯举",
      "preacher curl"
    ],
    "bodyPart": "臂",
    "equipment": "杠铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "拉",
    "level": "初级",
    "primaryMuscles": [
      "二头"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "上臂贴牧师凳斜面，握杠或哑铃。",
      "屈肘弯举至顶端收紧二头。",
      "控制下放至手臂接近伸直但不锁死，重复。"
    ],
    "images": []
  },
  {
    "id": "triceps-pushdown",
    "name": "绳索三头下压",
    "aliases": [
      "三头下压",
      "绳索下压",
      "triceps pushdown"
    ],
    "bodyPart": "臂",
    "equipment": "绳索",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "推",
    "level": "初级",
    "primaryMuscles": [
      "三头"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "面对高位绳索，双手握把，肘贴身固定。",
      "伸肘把手柄下压至手臂伸直、顶端收紧三头。",
      "控制还原至前臂接近水平，重复。"
    ],
    "images": []
  },
  {
    "id": "close-grip-bench-press",
    "name": "窄距卧推",
    "aliases": [
      "窄握卧推",
      "窄距卧推",
      "close grip bench press"
    ],
    "bodyPart": "臂",
    "equipment": "杠铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "中级",
    "primaryMuscles": [
      "三头"
    ],
    "secondaryMuscles": [
      "胸",
      "肩"
    ],
    "instructions": [
      "仰卧平凳，握距约与肩同宽握杠。",
      "下放至触碰下胸，肘贴身。",
      "用三头发力推起至手臂伸直，重复。"
    ],
    "images": []
  },
  {
    "id": "lying-triceps-extension",
    "name": "仰卧臂屈伸",
    "aliases": [
      "碎颅者",
      "仰卧臂屈伸",
      "skull crusher"
    ],
    "bodyPart": "臂",
    "equipment": "杠铃",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "推",
    "level": "中级",
    "primaryMuscles": [
      "三头"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "仰卧平凳，握杠（或 EZ 杠）举于额上方，上臂垂直地面。",
      "屈肘把杠铃下放至接近额头，上臂保持不动。",
      "伸肘推回起点，重复。"
    ],
    "images": []
  },
  {
    "id": "bench-dips",
    "name": "凳上臂屈伸",
    "aliases": [
      "凳上臂屈伸",
      "椅上臂屈伸",
      "bench dips"
    ],
    "bodyPart": "臂",
    "equipment": "自重",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "复合",
    "force": "推",
    "level": "初级",
    "primaryMuscles": [
      "三头"
    ],
    "secondaryMuscles": [
      "肩",
      "胸"
    ],
    "instructions": [
      "双手撑于身后平凳边缘，双腿前伸。",
      "屈肘下放身体至肘约 90 度。",
      "用三头发力推起至手臂伸直，重复。"
    ],
    "images": []
  },
  {
    "id": "crunches",
    "name": "卷腹",
    "aliases": [
      "卷腹",
      "仰卧卷腹",
      "crunches"
    ],
    "bodyPart": "核心",
    "equipment": "自重",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "推",
    "level": "初级",
    "primaryMuscles": [
      "腹肌"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "仰卧屈膝，双手轻置耳侧或胸前。",
      "用腹部发力把肩胛卷离地面，下背贴地。",
      "顶端收紧后控制还原，重复。"
    ],
    "images": []
  },
  {
    "id": "air-bike-crunch",
    "name": "自行车卷腹",
    "aliases": [
      "单车卷腹",
      "自行车卷腹",
      "bicycle crunch",
      "air bike"
    ],
    "bodyPart": "核心",
    "equipment": "自重",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "推",
    "level": "初级",
    "primaryMuscles": [
      "腹肌"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "仰卧，双手轻扶耳侧，双腿抬起做蹬车动作。",
      "卷腹同时用一侧手肘靠近对侧膝盖，交替进行。",
      "保持下背贴地、节奏可控，重复。"
    ],
    "images": []
  },
  {
    "id": "plank",
    "name": "平板支撑",
    "aliases": [
      "平板支撑",
      "plank"
    ],
    "bodyPart": "核心",
    "equipment": "自重",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "静态",
    "level": "初级",
    "primaryMuscles": [
      "腹肌"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "前臂与脚尖撑地，肘在肩正下方。",
      "收紧核心与臀，使头、背、臀、腿成一条直线。",
      "保持均匀呼吸静态支撑，避免塌腰或翘臀。"
    ],
    "images": []
  },
  {
    "id": "hanging-leg-raise",
    "name": "悬垂举腿",
    "aliases": [
      "悬垂举腿",
      "吊举腿",
      "hanging leg raise"
    ],
    "bodyPart": "核心",
    "equipment": "自重",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "拉",
    "level": "中级",
    "primaryMuscles": [
      "腹肌"
    ],
    "secondaryMuscles": [
      "前臂"
    ],
    "instructions": [
      "正握单杠悬垂，身体稳定不晃。",
      "用腹部发力把双腿向上抬起至与地面平行或更高。",
      "控制下放回悬垂，不借摆动，重复。"
    ],
    "images": []
  },
  {
    "id": "russian-twist",
    "name": "俄罗斯转体",
    "aliases": [
      "俄罗斯转体",
      "坐姿转体",
      "russian twist"
    ],
    "bodyPart": "核心",
    "equipment": "自重",
    "isSystem": true,
    "userId": null,
    "category": "力量",
    "mechanic": "孤立",
    "force": "推",
    "level": "中级",
    "primaryMuscles": [
      "腹肌"
    ],
    "secondaryMuscles": [],
    "instructions": [
      "坐姿屈膝、上身后倾约 45 度，可双手持哑铃/杠铃片。",
      "保持核心收紧把躯干向左右交替转动。",
      "控制节奏、双脚可抬离地面增加难度，重复。"
    ],
    "images": []
  }
];

// 按 id 取单条（详情兜底）
function findById(id) {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) return items[i];
  }
  return null;
}

module.exports = { items, findById };
