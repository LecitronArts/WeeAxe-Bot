const mineflayer = require('mineflayer')
const fs = require('node:fs');
const fsPro = require('node:fs/promises');
const { fromArrayBuffer, Instrument } = require("@nbsjs/core");
const { Song } = require('@nbsjs/core')
const join = require("node:path");
const { sleep } = require("mineflayer/lib/promise_utils");
const path = require('path');
const Fuse = require('fuse.js'); //模糊搜索

// bot常量
// 配置文件
const loginPassword = "";
const serverHost = 'mc.weeaxe.cn';
const serverPort = "25565"
const botOwner = 'LecitronArts';
const mainBotName = 'Lemon_GHK'
const songRepository = `D:/Files/Minecraft Note Block Studio/Songs/`// 曲库根目录




/// ----------------- noteBot ----------------- ///

// notebot常量

// 标准化曲库根目录路径
const baseSongDir = path.resolve(songRepository); // 转为标准化绝对路径（关键！统一格式对比）
/// 两
const instrCharMap = {
  0: "一丁丂七丄丅丆万丈三上下丌不与丏丐丑丒专且丕世丗丘丙业丛东丝丞丟丠両丢丣两严並丧丨丩个丫丬中丮丯丰丱串丳临丵丶丷丸丹为主丼丽举丿乀乁乂乃乄久乆乇么义乊之乌乍乎乏乐乑乒乓乔乕乖乗".split(''),
  1: "亀亁亂亃亄亅了亇予争亊事二亍于亏亐云互亓五井亖亗亘亙亚些亜亝亞亟亠亡亢亣交亥亦产亨亩亪享京亭亮亯亰亱亲亳亴亵亶亷亸亹人亻亼亽亾亿什仁仂仃仄仅仆仇仈仉今介仌仍从仏仐仑仒仓仔仕他仗".split(''),
  2: "伀企伂伃伄伅伆伇伈伉伊伋伌伍伎伏伐休伒伓伔伕伖众优伙会伛伜伝伞伟传伡伢伣伤伥伦伧伨伩伪伫伬伭伮伯估伱伲伳伴伵伶伷伸伹伺伻似伽伾伿佀佁佂佃佄佅但佇佈佉佊佋佌位低住佐佑佒体佔何佖佗".split(''),
  3: "侀侁侂侃侄侅來侇侈侉侊例侌侍侎侏侐侑侒侓侔侕侖侗侘侙侚供侜依侞侟侠価侢侣侤侥侦侧侨侩侪侫侬侭侮侯侰侱侲侳侴侵侶侷侸侹侺侻侼侽侾便俀俁係促俄俅俆俇俈俉俊俋俌俍俎俏俐俑俒俓俔俕俖俗".split(''),
  4: "倀倁倂倃倄倅倆倇倈倉倊個倌倍倎倏倐們倒倓倔倕倖倗倘候倚倛倜倝倞借倠倡倢倣値倥倦倧倨倩倪倫倬倭倮倯倰倱倲倳倴倵倶倷倸倹债倻值倽倾倿偀偁偂偃偄偅偆假偈偉偊偋偌偍偎偏偐偑偒偓偔偕偖偗".split(''),
  5: "傀傁傂傃傄傅傆傇傈傉傊傋傌傍傎傏傐傑傒傓傔傕傖傗傘備傚傛傜傝傞傟傠傡傢傣傤傥傦傧储傩傪傫催傭傮傯傰傱傲傳傴債傶傷傸傹傺傻傼傽傾傿僀僁僂僃僄僅僆僇僈僉僊僋僌働僎像僐僑僒僓僔僕僖僗".split(''),
  6: "儀儁儂儃億儅儆儇儈儉儊儋儌儍儎儏儐儑儒儓儔儕儖儗儘儙儚儛儜儝儞償儠儡儢儣儤儥儦儧儨儩優儫儬儭儮儯儰儱儲儳儴儵儶儷儸儹儺儻儼儽儾儿兀允兂元兄充兆兇先光兊克兌免兎兏児兑兒兓兔兕兖兗".split(''),
  7: "冀冁冂冃冄内円冇冈冉冊冋册再冎冏冐冑冒冓冔冕冖冗冘写冚军农冝冞冟冠冡冢冣冤冥冦冧冨冩冪冫冬冭冮冯冰冱冲决冴况冶冷冸冹冺冻冼冽冾冿净凁凂凃凄凅准凇凈凉凊凋凌凍凎减凐凑凒凓凔凕凖凗".split(''),
  8: "刀刁刂刃刄刅分切刈刉刊刋刌刍刎刏刐刑划刓刔刕刖列刘则刚创刜初刞刟删刡刢刣判別刦刧刨利刪别刬刭刮刯到刱刲刳刴刵制刷券刹刺刻刼刽刾刿剀剁剂剃剄剅剆則剈剉削剋剌前剎剏剐剑剒剓剔剕剖剗".split(''),
  9: "劀劁劂劃劄劅劆劇劈劉劊劋劌劍劎劏劐劑劒劓劔劕劖劗劘劙劚力劜劝办功加务劢劣劤劥劦劧动助努劫劬劭劮劯劰励劲劳労劵劶劷劸効劺劻劼劽劾势勀勁勂勃勄勅勆勇勈勉勊勋勌勍勎勏勐勑勒勓勔動勖勗".split(''),
  10: "匀匁匂匃匄包匆匇匈匉匊匋匌匍匎匏匐匑匒匓匔匕化北匘匙匚匛匜匝匞匟匠匡匢匣匤匥匦匧匨匩匪匫匬匭匮匯匰匱匲匳匴匵匶匷匸匹区医匼匽匾匿區十卂千卄卅卆升午卉半卋卌卍华协卐卑卒卓協单卖南".split(''),
  11: "厀厁厂厃厄厅历厇厈厉厊压厌厍厎厏厐厑厒厓厔厕厖厗厘厙厚厛厜厝厞原厠厡厢厣厤厥厦厧厨厩厪厫厬厭厮厯厰厱厲厳厴厵厶厷厸厹厺去厼厽厾县叀叁参參叄叅叆叇又叉及友双反収叏叐发叒叓叔叕取受".split(''),
  12: "吀吁吂吃各吅吆吇合吉吊吋同名后吏吐向吒吓吔吕吖吗吘吙吚君吜吝吞吟吠吡吢吣吤吥否吧吨吩吪含听吭吮启吰吱吲吳吴吵吶吷吸吹吺吻吼吽吾吿呀呁呂呃呄呅呆呇呈呉告呋呌呍呎呏呐呑呒呓呔呕呖呗".split(''),
  13: "咀咁咂咃咄咅咆咇咈咉咊咋和咍咎咏咐咑咒咓咔咕咖咗咘咙咚咛咜咝咞咟咠咡咢咣咤咥咦咧咨咩咪咫咬咭咮咯咰咱咲咳咴咵咶咷咸咹咺咻咼咽咾咿哀品哂哃哄哅哆哇哈哉哊哋哌响哎哏哐哑哒哓哔哕哖哗".split(''),
  14: "唀唁唂唃唄唅唆唇唈唉唊唋唌唍唎唏唐唑唒唓唔唕唖唗唘唙唚唛唜唝唞唟唠唡唢唣唤唥唦唧唨唩唪唫唬唭售唯唰唱唲唳唴唵唶唷唸唹唺唻唼唽唾唿啀啁啂啃啄啅商啇啈啉啊啋啌啍啎問啐啑啒啓啔啕啖啗".split(''),
  15: "喀喁喂喃善喅喆喇喈喉喊喋喌喍喎喏喐喑喒喓喔喕喖喗喘喙喚喛喜喝喞喟喠喡喢喣喤喥喦喧喨喩喪喫喬喭單喯喰喱喲喳喴喵営喷喸喹喺喻喼喽喾喿嗀嗁嗂嗃嗄嗅嗆嗇嗈嗉嗊嗋嗌嗍嗎嗏嗐嗑嗒嗓嗔嗕嗖嗗".split('')
}




// notebot初始化变量

let isPlayingId = 0;
let childBotList = [];

// notebot函数
async function playNBS(filePath,filename,bot,username) {
      //机器人feedback设置
      let user = botOwner;
      user = username;


      // bot.chat("/tp "+username);
      // rideme(bot,user)

      stopNBS();
      let nowIsPlayingId = isPlayingId;//"退出"控制
      // isPlaying = true;


      //路径安全校验
      // 拼接完整路径并标准化，自动解析 ../ 等跳转
      const targetFullPath = path.resolve(path.join(filePath, filename));
      // 校验：目标文件必须在 baseSongDir 内部
      if (!targetFullPath.startsWith(baseSongDir)) {
        bot.whisper(user, `非法路径，你在看哪里喵！`);
        console.warn(`路径拦截！尝试访问：${targetFullPath}，基准目录：${baseSongDir}`);
        return;
      }


      //解析文件
      let songFile;
      try {
        songFile = fs.readFileSync(filePath + filename); // Read the selected NBS file
      } catch (err) {
        isPlaying = false;
        console.error("读取文件出错喵：",err.message);
        bot.whisper(user,"读取文件出错喵：" + err.message);
        return;
      }

      const buffer = new Uint8Array(songFile).buffer; // Convert it into an ArrayBuffer
      const song = fromArrayBuffer(buffer); // Parse the buffer
      const songLength = song.getLength();
      const songSpeed = song.getTimePerTick();
      const songTimeTotal = songLength * songSpeed;
      let songName = '未命名歌曲喵';
      if (song.name) songName = song.name;
      let transId = 1;            // transactionId 自增ID
      console.log("  -playNBS.读取")
      console.log("正在播放 " + songName);
      console.log("曲长 " + songLength);
      console.log("曲速 " + songSpeed);
      console.log("总时间(毫秒) " + songTimeTotal);
      console.log("切换键盘到 unicode")
      bot.chat("/piano keyboard unicode");
      // console.log(song);




      // 预处理
      console.log("  -playNBS.预处理")
      const layer1 = [];
      for(let j = 0; j <= songLength; j += 1){
        const layer2 = [];

        for(let i = song.layers.getTotal()-1; i >= 0; i -= 1){
            if(nowIsPlayingId != isPlayingId) return;//“退出”控制
            // if(isPlaying == false) return;
            if(song.layers.all[i].notes.all.length === 0) continue;
            const key = String(j);
            if (song.layers.all[i].notes.all.hasOwnProperty(key)) {
                const note = song.layers.all[i].notes.all[key];

                const temp = instrCharMap[note.instrument]?.[note.key+4] ?? "";
                const packetText = "/// " + temp;
                layer2.push(packetText);
              }
        }
        if (layer2){
          layer1.push(layer2);
        }
        else{
          layer1.push(null);
        }
      }
      
      //多音响处理
      console.log("  -playNBS.多音响处理")
      let totalNotes = layer1.reduce((sum, row) => 
        Array.isArray(row) ? sum + row.length : sum, 0
      );
      console.log("音符总数 "+totalNotes)
      let avgNoteNum = totalNotes/(songTimeTotal/songSpeed)
      console.log("平均每个时刻音符播放数 "+avgNoteNum)
      let botNum = Math.ceil(avgNoteNum / 2.3);
      console.log("需要的bot总数 "+botNum);
      if(botNum>1){
        for(let k = 1; k < botNum; k++){
          const temp = await createChildBot(k);
          childBotList.push(temp);
          console.log("将 "+ temp.username +" 放入childBotList")
          console.log("现有childBotList长度 " + childBotList.length)
        }
      }
      childBotList.forEach(bots => {
        // 先判断实例存在且连接未断开，避免报错
        if (bots) {
          console.log ('childBotList内所有玩家名 '+bots.username)
        }
      });


      const botList = childBotList;
      botList.push(bot);
      let botPointer = 0;
      console.log('得到的bot总数 '+botList.length)

      // 播放
      console.log("  -playNBS.播放")
      let nextTick = performance.now(); // 全局时间基准

      for(let j = 0; j <= layer1.length; j += 1){
        if(nowIsPlayingId != isPlayingId) return;// “退出”控制
        // if(isPlaying == false) return;
        const now = performance.now();
        let waitMs = Math.ceil(nextTick - now);
        // console.log("j:"+j+"  waitMs:"+waitMs +"  now:"+now+"  nextTick"+nextTick) // 延时检测器
        if(0.7*layer1[j-1]?.length) {
          waitMs -= 0.7*layer1[j-1]?.length
        }
        if (waitMs > 0) {
          await sleep(waitMs);
        }
        nextTick = nextTick + songSpeed;
        if(layer1[j]){
          for(let i = layer1[j].length-1; i >= 0; i -= 1){
              // 发送 tab_complete 数据包
              if(nowIsPlayingId == isPlayingId){
                botList[botPointer]._client.write('tab_complete', {
                transactionId: transId++,
                text: layer1[j][i]
                })
              }
              botPointer++;
              if (botPointer >= botNum) botPointer = 0;
          }
        }
        // // await里移除发包额外产生的延迟
        // await sleep(songSpeed - layer1[j+1].length);
    }
    stopNBS();
}

/// ----------------- Notebot.functions

function stopNBS(bot,username){
  // isPlaying = false;
  if(username && bot){
      bot.whisper(username,"已停止播放喵！");
      console.log("-> "+username+" 已停止播放喵！")
  }
  isPlayingId++;

  childBotList.forEach(bots => {
  // 先判断实例存在且连接未断开，避免报错
  if (bots && bots._client && !bots._client.ended) {
    if (bots.username != mainBotName) {
      bots.quit();
      console.log ('childBotList.length为 ' + childBotList.length)
      console.log ('下线bot.username ' + bots.username)
    }
  }
});
  childBotList.length = 0;
}



// nbs文件检索
async function searchNBSfile(keyword) {
  // 1. 获取全部文件
  const allPaths = await readAllFiles(songRepository, ['.nbs']);

  // 构造检索数据集
  const list = allPaths.map(p => ({ path: p, filename: path.basename(p) }));

  // Fuse 配置
  const fuseOptions = {
    includeScore: true,       // 返回匹配分数
    threshold: 0.4,           // 阈值：0=精确匹配，1=匹配所有；越小越严格
    ignoreLocation: true,
    keys: [
      { name: 'filename', weight: 1 },
    ]
  };

  const fuse = new Fuse(list, fuseOptions);
  const rawResult = fuse.search(keyword).filter(item => item.score <= 0.333);// 过滤掉匹配度低的结果

  
  // 格式化输出，fuse 结果默认已经【匹配度从高到低排好序】
  return rawResult.map(item => {
    const fullPath = item.item.path;
    const relativePath = toRelativePath(fullPath);
    const songName = item.item.filename
    return {
      filePath: fullPath,           // 完整绝对路径（给程序读取文件用）
      relativePath: relativePath,   // 截断后的相对路径（给聊天展示用）
      songName: songName,
      matchScore: item.score,  // 0 = 完全匹配，越接近1相似度越低
      hover:"点击播放",
      click:"/tell "+ mainBotName +" #play " + relativePath
    };
  });

  // // 格式化输出，fuse 结果默认已经【匹配度从高到低排好序】
  // return rawResult.map(item => ({
  //   filePath: item.item.path,
  //   fileName: item.item.filename,
  //   matchScore: item.score // 0 = 完全匹配，越接近1相似度越低
  // }));
}





/// ----------------- bot ----------------- ///

/// bot ///
function createBot () {

  const bot = mineflayer.createBot({
  host: serverHost, // minecraft server ip mc.weeaxe.cn localhost
  port: serverPort,              // set if you need a port that isn't 25565
  username: mainBotName, // username to join as if auth is `offline`, else a unique identifier for this account. Switch if you want to change accounts
  auth: 'offline' // for offline mode servers, you can set this to 'offline'
  // version: false,           // only set if you need a specific version or snapshot (ie: "1.8.9" or "1.16.5"), otherwise it's set automatically
  // password: '12345678'      // set if you want to use password-based auth (may be unreliable). If specified, the `username` must be an email
})


const cmdList = [
  {
    prefix: "#play ",   // 指令前缀（注意带空格）
    handler: (content,username) => playNBS(songRepository,content,bot,username) // 对应执行函数
  },
  {
    prefix: "#stop",
    handler: (content,username) => stopNBS(bot,username)
  },
  {
    prefix: "#ride",
    handler: (content,username) => allRideme(bot,username)
  },
  {
    prefix: "#menu",
    handler: () => mainMenu()
  },
  {
    prefix: "#search ",
    handler: (content,username) => {searchNBS(content,bot,username)}
  },
  // 指令提示
  {
    prefix: "#play",   
    handler: (content,username) => {bot.whisper(username,"指令用法：/tell " + mainBotName + " #play 歌曲文件名(建议先#search)")}
  },
  {
    prefix: "#search",
    handler: (content,username) => {bot.whisper(username,"指令用法：/tell " + mainBotName + " #search 歌曲名,页码")}
  },
  {
    prefix: "#test ",
    handler: (content,username) => test(bot,content)
  }
];



/// 私聊执行
  bot.on('whisper', (username, message) => {
    
    if (username === bot.username) return
    if (username === 'me') return
    console.log("\n[whisper] " + username + " -> " + message + "\n")
    if (username === botOwner) {

      if (message[0] !== '#') {
        bot.chat(message);
        return;
      }
    }
    for (const cmd of cmdList) {
      if (message.startsWith(cmd.prefix)) {
        // 截取前缀后面的内容
        const param = message.slice(cmd.prefix.length).trim();
        // 执行对应逻辑
        cmd.handler(param,username);
        return; // 匹配到就终止，避免多条指令误触发
      }
    }


  })
/// 进服登录
  bot.on('spawn', () => {
    var message = "/login "+loginPassword
    console.log("主bot登录" + message)
    bot.chat(message)
    //停止音乐
    stopNBS();
  })


/// 掉线处理

  bot.on('kicked', (reason) => {
    console.log('==== 原始踢人数据 ====');
    // 直接打印完整结构，看清真实字段
    printObj(reason);

    let kickMsg = '';
    // 1. 先判断：普通对象（优先级最高）
    if (typeof reason === 'object' && reason !== null) {
      kickMsg = JSON.stringify(reason, null, 2);
    }
    // 2. 纯字符串
    else if (typeof reason === 'string') {
      kickMsg = reason;
    }
    // 3. 有 toString 方法（兜底）
    else if (typeof reason?.toString === 'function') {
      kickMsg = reason.toString();
    }
    console.log('被踢原因：\n', kickMsg);
  });

  // bot.on('kicked', (reason) => {
  //   console.log(reason.toJSON()) // 原始聊天组件 JSON
  //   console.log(reason.toString()) // 转成纯文本（最常用）
  // })
  // bot.on('kicked', (err) => {
  //   console.log(JSON.stringify(err.value.extra.value, null, 2));
  // })
  bot.on('error', (err) => {
    console.log(err);
  })
  bot.on('end', () => {
    console.log('已断开，5秒后重连...')
    setTimeout(createBot, 5000)
  })
}





/// 子bot ///
async function createChildBot (botNum) {
  console.log("  -playNBS.createChildBot创建 " + botNum + "号子bot")
  const bots = mineflayer.createBot({
  host: serverHost, // minecraft server ip mc.weeaxe.cn localhost
  port: serverPort,
  username: mainBotName + 'Z'.repeat(botNum), // username to join as if auth is `offline`, else a unique identifier for this account. Switch if you want to change accounts
  // username: 'AnJoGZZ', // username to join as if auth is `offline`, else a unique identifier for this account. Switch if you want to change accounts
  auth: 'offline' // for offline mode servers, you can set this to 'offline'
})

/// 私聊执行
  bots.on('whisper', (username, message) => {
    
    if (username === bots.username) return
    if (username === 'me') return
    if (username === botOwner) {

      if (message[0] !== '#') {
        bots.chat(message);
        return;
      }
    }
  })
/// 进服登录
  bots.on('spawn', () => {
    bots.chat("/register "+loginPassword+" "+loginPassword)
    var message = "/login "+loginPassword
    console.log("子bot登录" + message)
    bots.chat(message)
    bots.chat("/piano keyboard unicode");
    bots.chat("/tp "+mainBotName);
    
  })

///掉线处理
  bots.on('kicked', console.log)
  bots.on('error', (err) => console.log(err))

  await sleep(3500);
  return bots;
}


createBot()

/// ----------------- bot.functions

async function rideme(bot,username){
    bot.chat("/tp "+username);
    bot.creative.clearSlot(bot.quickBarSlot+36)
    if (username) {
      setTimeout(() => {
        const sitOn = bot.nearestEntity(e => e.username === username && bot.entity.position.distanceTo(e.position))
        if (sitOn) {
          bot.chat("/tp "+username);
          bot.activateEntityAt(sitOn, sitOn.position)
        }
      }, 2000)
    }
    bot.whisper("已执行喵",username);
}

async function allRideme(bot,username){
  if(childBotList.length > 0){
    childBotList.forEach(bots => {
      // 先判断实例存在且连接未断开，避免报错
      if (bots && username) {
        rideme(bots,username)
      }
    });
  }else{
    rideme(bot,username)
  }
}




async function test(bot,content){
  // if(bot.entityAtCursor(maxDistance=3.5)){
  //       bot.activateEntity(bot.entityAtCursor(maxDistance=3.5))
  //       // bot.attack(bot.entityAtCursor(maxDistance=3.5), swing = true)
  //       // bot.simpleClick.leftMouse (bot.quickBarSlot)
  //       // bot.mount(bot.entityAtCursor(maxDistance=3.5))
  // }

    // try {
    //   // 筛选出玩家实体
    //   const targetPlayer = bot.nearestEntity(entity => {
    //     return entity.type === 'player' && entity.username !== bot.username;
    //   });

    //   if (!targetPlayer) {
    //     console.log('附近没有可交互的玩家');
    //     return;
    //   }

    //   // 1. 对准目标（模拟真人，规避反作弊+插件检测）
    //   await bot.lookAt(targetPlayer.position);

    //   // 2. 实体右键交互（空手自动生效，触发GSit的PlayerInteractEntityEvent）
    //   await bot.activateEntity(targetPlayer);
    //   console.log('已向玩家发起乘坐请求，等待服务端响应');

    // } catch (err) {
    //   console.error('交互异常：', err);
    // }
  // bot.whisper('Ashlqy',"<click:suggest_command:'/tp ANRV'><hover:show_text:'its a message'>test1</hover></click>")





  searchNBS(content,bot,username,currentPage)



  bot.whisper('Ashlqy',"已执行喵")
}


/// ----------------- MenuSystem ----------------- ///

// NBS搜索页
async function searchNBS(content,bot,username) {


const lastCommaIndex = content.lastIndexOf(',');

  if (lastCommaIndex === -1) {
    // 没有逗号，只有关键词，页码默认1
    keyword = content.trim();
    currentPage = 1;
  } else {
    // 按最后一个逗号分割
    keyword = content.slice(0, lastCommaIndex).trim();
    currentPage = Number(content.slice(lastCommaIndex + 1).trim()) || 1;
  }
  // pageSize,pagerCount,content,currentPage,bot,username

  const results = await searchNBSfile(keyword)
  console.log(`找到 ${results.length} 条匹配结果：\n`);

  //log
  results.forEach((res, idx) => {
    console.log(`[${idx+1}] 分数:${res.matchScore.toFixed(3)} | ${res.relativePath}`);
    // console.log(`[${idx+1}] hover:${res.hover} | click:${res.click}`);
  });
  
  const header1 = "'''<b>NBS.bot</b> <dark_gray><st>--------------------</st></dark_gray> <gray>Search</gray> <dark_gray><st>--------------------</st></dark_gray>"
  bot.whisper(username,header1)
  await sleep(150)
  const header2 = " “" + keyword + "” 共找到 " + (results.length || 0) + " 条结果"
  bot.whisper(username,header2)
  Pagination(5,3,results,currentPage,bot,username,searchNBSitemConstructor,"/tell " + mainBotName + " #search "+keyword+",")

}

// NBS搜索页条目构造器
function searchNBSitemConstructor(index,content,bot,username){
  const start = "<dark_gray>"
  let left = "] <gray>> "
  const color = index % 2 ? "<white>" : "<gray>";
  
  const main = `<click:suggest_command:"${content[index].click}"><hover:show_text:"${content[index].hover}"><u>${color}${content[index].songName}`
  const right = ""
  bot.whisper(username,start + index + left + main + right);
}




// 通用分页器
// 记得验证currentPage存在 默认值为1
async function Pagination(pageSize,pagerCount,content,currentPage,bot,username,constructor,switchPageCommand) {
  const total = content.length;
  const totalPage = Math.ceil(total / pageSize)

  // pagerCount 最大页码按钮数
  // 锁上下限
  if (currentPage > totalPage) {currentPage = totalPage}
  if (currentPage < 1) {currentPage = 1}
  // 条目
  for (let i = 0; i < pageSize; i++){
    await sleep(100)
    const index = i + (currentPage - 1) * pageSize;
    if (index < total) constructor(index,content,bot,username);
  }

  await sleep(150)


  // 页码列表

  let footer = "当前页面 <gray>" + currentPage + "/"  +totalPage
  let prevPage = "";
  let nextPage = "";
  // let firstPage = "";
  // let lastPage = "";
  let pageIndexList = ""
  if (currentPage > 1) prevPage = `<click:suggest_command:"${switchPageCommand}${currentPage-1}"><hover:show_text:"跳转到上一页"> <<< `
  if (currentPage < totalPage) nextPage = `<click:suggest_command:"${switchPageCommand}${currentPage+1}"><hover:show_text:"跳转到下一页"> >>> `
  // if (currentPage > 1) firstPage = `<click:suggest_command:"${switchPageCommand}1"><hover:show_text:"跳转到首页"> <<< `
  // if (currentPage < totalPage) lastPage = `<click:suggest_command:"${switchPageCommand}${totalPage}"><hover:show_text:"跳转到尾页"> >>> `

  const startPage = currentPage == 1 ? 1 : currentPage - 1;

  for (let i = startPage ; i <= totalPage && i <= currentPage + pagerCount - 1; i++) {
    if (i == currentPage) {pageIndexList += ` <u>${i}</u> |`; continue;}
    pageIndexList += `<click:suggest_command:"${switchPageCommand}${i}"> ${i} |`
  }
  bot.whisper(username,footer)
  await sleep(150)
  bot.whisper(username,pageIndexList)
  await sleep(150)
  bot.whisper(username,prevPage + nextPage)
  // await sleep(150)
  // bot.whisper(username,firstPage + lastPage)
}





/// ----------------- Utils ----------------- ///


// 解包打印踢出日志
function printObj(data, indent = 0) {
  const pad = ' '.repeat(indent);
  if (typeof data !== 'object' || data === null) {
    console.log(pad + data);
    return;
  }
  if (Array.isArray(data)) {
    console.log(pad + '[');
    data.forEach((item, i) => {
      console.log(pad + `  [${i}]:`);
      printObj(item, indent + 4);
    });
    console.log(pad + ']');
    return;
  }
  console.log(pad + '{');
  Object.entries(data).forEach(([key, val]) => {
    console.log(pad + `  "${key}":`);
    printObj(val, indent + 4);
  });
  console.log(pad + '}');
}


// 读取目录下所有文件
// async function readAllFiles(dir) {
//   const result = [];
//   const entries = await fs.readdir(dir, { withFileTypes: true });
//   for (const entry of entries) {
//     const fullPath = path.join(dir, entry.name);
//     if (entry.isDirectory()) {
//       const sub = await readAllFiles(fullPath);
//       result.push(...sub);
//     } else if (entry.isFile()) {
//       result.push(fullPath);
//     }
//   }
//   return result;
// }



// 读取目录下所有文件 通用读取文件函数
// const allPaths = await readAllFiles('./files', ['.nbs', '.mp3', '.txt']);
async function readAllFiles(dir, extList) {
  const result = [];
  const entries = await fsPro.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const subFiles = await readAllFiles(fullPath, extList);
      result.push(...subFiles);
    } else if (entry.isFile()) {
      // 没有指定后缀 → 全部收集
      if (!extList || extList.length === 0) {
        result.push(fullPath);
        continue;
      }
      // 匹配后缀（大小写兼容）
      const ext = path.extname(fullPath).toLowerCase();
      if (extList.includes(ext)) {
        result.push(fullPath);
      }
    }
  }
  return result;
}

// 截断去掉曲库根目录前缀，返回相对路径
function toRelativePath(fullPath) {
  const abs = path.resolve(fullPath);
  if (abs.startsWith(baseSongDir)) {
    // 切掉基准前缀
    const rel = abs.slice(baseSongDir.length);

    return rel
  }
  // 不在基准目录内，原样返回（安全校验会拦截，这里兜底）
  return abs;
}



