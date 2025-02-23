import { _decorator, Camera, clamp, Collider, Color, Component, director, dynamicAtlasManager, EventTouch, geometry, Input, input, instantiate, Layers, macro, MeshRenderer, Node, NodePool, PhysicsSystem, Prefab, profiler, Quat, randomRangeInt, RigidBody, SpriteAtlas, toDegree, toRadian, Tween, tween, UIOpacity, UITransform, Vec3, view } from 'cc';
import { CubeMesh } from './Mesh';
import { Levels } from './Levels';
import { adManager, PlatformUtils } from '../ttPlugin';

const { ccclass, property } = _decorator;

const ButtonLimit = 3;
const DailyUserInfoKey = 'daliy_user_info';
//device.getFormatFeatures(FormData.RGBA32F)

@ccclass('Cubes')
export class Cubes extends Component {

  @property(Prefab)
  cube:Prefab = null;
  @property(Color)
  color:Color = new Color('#0785FA'); // ['#0785FA','#24B300','#FF7EEF','#FFFFFF'];
  @property(SpriteAtlas)
  sprAtlas:SpriteAtlas = null;
  @property(Node)
  cameraNode:Node = null;
  @property(Node)
  selcetNode:Node = null;
  @property(Node)
  uiNode:Node = null;


  camera0:Camera = null;
  camera1:Camera = null;

  private _level:number = 0;
  private _config:any = null;
  private _locked:boolean = false;

  private _verFOV:number = 45;
  private _baseNode:Node = null;
  private _nodePool:NodePool = new NodePool();
  private _localBuffer:Float32Array = new Float32Array(4);

  private _effectInc:number = 0;
  private _matchCount:number = 0;
  private _paiSelectCount:number = 0; //已选择总数
  private _paiRands:Array<string> = new Array(); //新随机队列
  private _paiSelets:Array<Array<Node>> = new Array();  //已选麻将
  private _paiInWorld:Map<string,Array<Node>> = new Map(); //未选麻将
  
  ///每个按钮的每次触发限制，超过后需要观看广告
  private static ;
  private dailyInfo = {
    updateTime: null, 
    xiPaiCount: ButtonLimit,
    fanPaiCount: ButtonLimit,
    xiaoChuCount: ButtonLimit,
    huituiCount: ButtonLimit,
  };
//电子邮件puhalskijsemen@gmail.com
//网站 开vpn打开 http://web3incubators.com/
//电报https://t.me/gamecode999
  ///////////////////////////////////////////////////////////////////////////
  //测试按钮
  btnStart(){
    if(this._locked) return;
    this.resetGame();
    this.loadLevel(this._level);
    this.faPai();
  }
  btnXiPai(){
    if(this._locked) return;
    this.xiPai();
  }

  btnFanPai(){
    if(this._locked) return;
    this.fanPai();
  }

  btnTuiPai(){
    if(this._locked) return;
    this.tuiPai();
  }

  // btnZhuoPai(){
  //   this.zhuaPai();
  // }

  btnHePai(){
    if(this._locked) return;
    this.hePai()
  }
  ///////////////////////////////////////////////////////////////////////////

  putNode(node:Node){
    this._nodePool.put(node);
  }

  getNode(): Node {
    let node = this._nodePool.get();
    if(!node){
      node = instantiate(this.prefabNode());
    }
    return node;
  }

  prefabNode() {
    if(!this._baseNode){
      this._baseNode = instantiate(this.cube);
      let render = this._baseNode.getComponent(MeshRenderer);

      render.mesh = CubeMesh;
      let texture = this.sprAtlas.getTexture();
      let material = render.getSharedMaterial(0);
      material.setProperty("mainTexture",texture);
      material.setProperty('mainColor',this.color);

    }
    return this._baseNode;
  }


  //垂直fov 转 水平fov
  verticalFOVToHorizontal(verFOV:number, aspect:number){
    // 垂直fov的弧度
    let verFovRadian = toRadian(verFOV);
    // 视野高度的一半
    let camHalfHeight = Math.tan(verFovRadian / 2);
    // 水平视野的弧度
    let horFOVRadian = Math.atan(camHalfHeight * aspect) * 2;
    // 水平视野的角度
    return toDegree(horFOVRadian);
  }

   //水平fov 转 垂直fov 
  horizontalFOVToVertical(horFOV:number, aspect:number){
    // 水平fov的弧度
    let horFOVRadian = toRadian(horFOV);
    // 视野宽度的一半
    let camHalfWidth = Math.tan(horFOVRadian / 2);
    // 垂直视野的弧度
    let verFOVRadian = Math.atan(camHalfWidth / aspect) * 2;
    // 垂直视野的角度
    return toDegree(verFOVRadian);
  }

  fixCamera(){  
    
    this._verFOV = 45;
    let size = view.getVisibleSize();
    let aspect = size.width*1.0/size.height;

    //相机默认使用水平FOV，长宽>1：2 进行FOV适配转换
    this.camera0 = this.cameraNode.getChildByName('Camera0').getComponent(Camera);
    this.camera1 = this.cameraNode.getChildByName('Camera1').getComponent(Camera);
  
    if(aspect > 0.5){
      //宽屏，长宽>1：2 进行适配转换
      let horFOVRadian = this.verticalFOVToHorizontal(this._verFOV,aspect);
      this.camera1.fov = this.camera0.fov = horFOVRadian;
    }else{
      //默认情况计算对应的verFOV
      this._verFOV = this.horizontalFOVToVertical(this._verFOV*0.5,aspect);
    }

    this.camera0.camera.update(true);
    this.camera1.camera.update(true);
  }

  fixSceneUI(){

    let uiTop = this.uiNode.getChildByName('top');
    let uiBottom = this.uiNode.getChildByName('bottom');
    let uiSelect = this.uiNode.getChildByName('select');

    //3d场景宽度
    let worldLeft = this.camera0.convertToUINode(new Vec3(12,0,0),this.uiNode);

    //修正底部宽度
    let uitrans = uiBottom.getComponent(UITransform);
    uitrans.width = worldLeft.x*2.1; //外扩大一点

    //修正顶部宽度
    uitrans = uiTop.getComponent(UITransform);
    uitrans.width = worldLeft.x*2.1; //外扩大一点

    //修正Select的大小
    uitrans = uiSelect.getComponent(UITransform);
    let scale = worldLeft.x*2/uitrans.width;
    uiSelect.scale = new Vec3(scale,scale,scale);


    //调整3D背景大小
    let bg = this.cameraNode.getChildByName('BackGround');
    let length = this.camera0.node.position.length();
    scale = 2*Math.tan(toRadian(this._verFOV/2));
    bg.scale.set(scale*length,scale*length,1);

    //调整3D底面板位置
    let size = view.getVisibleSize();
    scale = -uiSelect.position.y/size.height;
    let offset = this.camera0.node.parent.position.z;
    this.selcetNode.setPosition(0,0,scale*bg.scale.y + offset);
    
  }
  //游戏启动时只执行一次
  private updateDailyInfo(){
    const tInfo = PlatformUtils.GetStorageData(DailyUserInfoKey);
    if(!tInfo){
      console.log('tInfo is null');
      return;
    }

    const date = new Date();
    const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDay()}`;

    if(dateStr == tInfo.updateTime){
      this.dailyInfo = tInfo;
    }
    
  }

  protected onLoad(): void {
      this.updateDailyInfo();

      this.fixCamera();
      this.fixSceneUI();
      profiler.showStats();
      input.on(Input.EventType.TOUCH_END, this.pickCube, this);

      this.scheduleOnce(()=>{
        this._level = 0;
        this.btnStart();
      });
  }

  onDestroy () {
    this._nodePool.clear();
    this._baseNode && this._baseNode.destroy();
    input.off(Input.EventType.TOUCH_END, this.pickCube, this);
  }

  enablePhysics(node:Node,enable:boolean){
    let body = node.getComponent(RigidBody);
    let collider = node.getComponent(Collider);
    body.enabled = enable;
    collider.enabled = enable;
  }

  setCubeTexture(node:Node,name:string){
    
 
    let frame = this.sprAtlas.getSpriteFrame(name);
    let rect = frame.rect;
    let texture = frame.texture;
    let buffer = this._localBuffer;
    buffer[0] = rect.x*1.0/texture.width;
    buffer[1] = rect.y*1.0/texture.height;
    buffer[2] = rect.width*1.0/texture.width;
    buffer[3] = rect.height*1.0/texture.height;
    let mRender = node.getComponent(MeshRenderer);
    mRender.setInstancedAttribute('a_uv', buffer);

  }

  resetGame(){

    Tween.stopAll();
    this.unscheduleAllCallbacks();

    let effects = this.uiNode.getChildByName('effects');
    effects.children[0].active = false;
    effects.children[1].active = false;
    effects.children[2].active = false;

    this._paiSelets.forEach((nodes:Array<Node>)=>{
      for(let i = nodes.length-1;i>=0;i--){
        this.putNode(nodes[i]);
      }
    })

    let nodes = this.node.children;
    for(let i = nodes.length-1;i>=0;i--){
      this.putNode(nodes[i]);
    }

    this._paiSelets.length = 0;
    this._paiSelectCount = 0;
    this._paiInWorld.clear();
    this._matchCount = 0;
    this._locked = false;
    
  }

  pickCube(event: EventTouch){
      // 以下参数可选
      let ray = new geometry.Ray();
      this.camera0.screenPointToRay(event.getLocationX(), event.getLocationY(), ray);
      if (PhysicsSystem.instance.raycastClosest( ray, 0x2, 100, false)) {
          const raycastClosestResult = PhysicsSystem.instance.raycastClosestResult;   
          let node = raycastClosestResult.collider.node;
          if(this.flyToSelect(node)){
            let nodes = this._paiInWorld.get(node.name);
            let idx = nodes.indexOf(node);
            if(idx >= 0)
              nodes.splice(idx,1);
          }
      }
  }



  loadLevel(lv){


    lv = clamp(0,Levels.length-1,lv);

    let config = Levels[lv];
    
    let types = config.TypeRands;
    let times = config.Count;
    this._config = config;
    this._level = lv;

    //所有种类名字
    let selectNames = []; 
    if(config.Types.length == 0){
      let allPais = this.sprAtlas.spriteFrames;
      for (const key of Object.keys(allPais)) {
        selectNames.push(key);
      }
    }else{
      let types = config.Types;
      for(let i = 0;i<types.length;i++){
        selectNames[i] = types[i];
      }
    }

    //随机剔除种类
    let length = selectNames.length;
    if(types > length) types = length;
    for(let i = 0 ; i < (length - types); i++){
      let j = randomRangeInt(0,length--);
      selectNames.splice(j,1);
    }

    //生成所有牌
    let paiRands = this._paiRands = [];
    for(let i = 0;i < times; i++){
      let j = i%types;
      let name = selectNames[j];
      paiRands.push(name,name,name);
    }

    //随机打乱所有牌
    length = paiRands.length;
    for(let i = 0;i < length ; i++){
      let j =  randomRangeInt(0,length);
      let temp = paiRands[i];
      paiRands[i] = paiRands[j];
      paiRands[j] = temp;
    }

  }

  /*拿牌*/
  getPai(name:string|null = null){

    if( !name ) name = this._paiRands.pop();
    if( !name ) return null;

    let node = this.getNode();
    this.node.addChild(node);

    this.enablePhysics(node , true);
    this.setCubeTexture(node , name);
    node.getComponent(RigidBody).angularDamping = 0.8;
    node.scale = this._level > 0? Vec3.ONE:new Vec3(1.25,1.25,1.25);;
    node.layer = Layers.Enum.DEFAULT;
    node.rotation = Quat.IDENTITY;
    node.name = name;

    //插入到world
    let nodes = this._paiInWorld.get(name);
    if(!nodes){
      nodes = [];
      this._paiInWorld.set(name,nodes);
    }
    nodes.push(node);

    return node;
    
  }


  wakeUpOthers(node:Node){
    let pos = node.position;
    let ray = new geometry.Ray(pos.x,pos.y,pos.z, 0,1,0);
    if(PhysicsSystem.instance.sweepBox(ray,new Vec3(1.5,1,2),node.rotation,0x2,20,false)){
       let results =  PhysicsSystem.instance.sweepCastResults;
       for(let i = 0;i<results.length;i++){
          results[i].collider.attachedRigidBody.wakeUp();
       }
    }
  }

  combineEffect(position:Vec3){
  
    let parent = this.uiNode.getChildByName('effects');
    let out = this.camera0.convertToUINode(position,parent);
    let node = parent.children[this._effectInc];
    node.position = out;
    node.active = true;

    let n0 = node.children[0];
    let n1 = node.children[1];
    let n2 = node.children[2];
    let o1 = n1.getComponent(UIOpacity);
    let o2 = n2.getComponent(UIOpacity);
    n0.setScale(new Vec3(1.5,1.5,1.5));
    n1.setScale(new Vec3(0.5,0.5,0.5));
    n2.setScale(Vec3.ZERO);
    o1.opacity = 255;
    o2.opacity = 255;

    tween().target(n0).to(0.2,{ scale: Vec3.ZERO},{easing:"quadOut"}).start();
  
    tween().target(n1).to(0.1,{ scale: Vec3.ONE},{easing:"quintOut"}).start();
    tween().target(o1).to(0.1,{ opacity: 0}).start();

    tween().target(n2).to(0.2,{ scale: Vec3.ONE},{easing:"quintOut"}).start();
    tween().target(o2).delay(0.1).to(0.1,{ opacity: 0}).start();

    this.scheduleOnce(()=>{ node.active = false; } , 0.25);

    this._effectInc = (++this._effectInc)%parent.children.length;
  
  }


  fixPosition(count:number , idx:number , finish:Function){
    let selects = this._paiSelets;
    let pos = this.selcetNode.position;
    for(let i = 0, k = 0;i < selects.length ;i++){
      let nodes = selects[i];
      for(let j = 0;j < nodes.length;j++,k++){
        let node = nodes[j];
        if(k >= idx){
          tween().target(node).to(0.3,{ position: new Vec3((k-3)*3.5,0,pos.z)},{easing:"quintOut"})
          .call(()=>{
            if(--count == 0){
              finish();
            }
          }).start();
        }
      }
    }
  }

  fixSelectEnd(){
    
    let count = 0;
    let selects = this._paiSelets;
    for(let i = selects.length - 1; i>= 0; i--){
      let nodes = selects[i];
      let length = nodes.length;
      if( length >= 3){
        count+=3;
        this._paiSelectCount-=3;
        if(nodes.length == 3) selects.splice(i,1);
        let n0 = nodes.pop();
        let n1 = nodes.pop();
        let n2 = nodes.pop();
        const end = ()=>{
          this.combineEffect(n1.worldPosition);
          this.putNode(n0);
          this.putNode(n1);
          this.putNode(n2);
          count-=3;
          if(count == 0){
            this.fixPosition(this._paiSelectCount , 0,()=>{});
          }
          if(++this._matchCount == this._config.Count){
            this._level++;
            this.btnStart(); //游戏结束完成
          }
        };
        let pos = n1.position;
        tween().target(n0).to(0.1,{ position: pos},{easing:"quadOut"}).start();
        tween().target(n2).to(0.1,{ position: pos},{easing:"quadOut"}).call(end).start();
      }
    }
  }

  flyToSelect(node:Node){
    
    if(this._paiSelectCount + 1 > 7 ) return false;
    this.enablePhysics(node,false);
    this.wakeUpOthers(node);
    this._paiSelectCount++;

    node.setParent(this.selcetNode.parent);
    node.layer = Layers.Enum.UI_3D;
    node.rotation = Quat.IDENTITY;
    node.setScale(new Vec3(0.95,0.95,0.95));
   
    let idx = 0;
    let isInsert = true;
    let selects = this._paiSelets;
    for(let i = 0,j = selects.length; i<j; i++){
      let nodes = selects[i];
      let length = nodes.length;
      if(nodes[0].name == node.name){
        isInsert = false;
        nodes.push(node);
        idx+=length;
        break;
      }
      idx+=length;
    }

    // 计算后移个数
    let count = this._paiSelectCount - idx;
    if( isInsert ) selects.push([node]);
    this.fixPosition(count , idx,()=>{
       this.fixSelectEnd();
    });

    return true;
  }

  /*合牌，选取一对组合*/
  hePai(){

    //最大空位牌数
    let maxCount = 7 - this._paiSelectCount;
    if( maxCount <= 0) return false;

    let selects = this._paiSelets;
    for(let i = 0;i < selects.length; i++){
      let nodes = selects[i];
      let length = 3 - nodes.length;
      if(length >= 0 && length <= maxCount){
        let name = nodes[0].name;
        let wNodes = this._paiInWorld.get(name);
        if( wNodes && length <= wNodes.length){
          for(let j = 0;j < length;j++){
            this.flyToSelect(wNodes.pop());
          }
          break;
        }
      }
    }
    return true;

  }

  /*翻牌，全部反面反转正面)*/
  fanPai(){

    this._locked = true;

    let side = 1;
    let ttt = tween(this.node);
    let node = this.camera0.node;
    for(let i = 0 ;i < 50; i++){
      side=-1*side;
      let x = (1.0 - Math.sin(i*Math.PI/100.0))*3;
      ttt.then(tween(node).to(0.02, { position: new Vec3(x*side,0,0)}));
    }
    ttt.then(tween(node).to(0.02, { position: Vec3.ZERO}));

    this.scheduleOnce(()=>{
      let childs = this.node.children;
      for(let i = 0; i < childs.length;i++){
        let node = childs[i];
        node.rotation = Quat.IDENTITY;
        node.getComponent(RigidBody).angularDamping = 1.0;
      }
    });

    ttt.call(()=>{
      let childs = this.node.children;
      for(let i = 0; i < childs.length;i++){
        childs[i].getComponent(RigidBody).angularDamping = 0.8;
      }
      this._locked = false;
    }).start();

  }

  /*洗牌，剩下回收再重发牌*/
  xiPai(){
  
    this._locked = true;

    let childs = this.node.children;
    let length = childs.length;
    if(length <= 0) return;
  
    PhysicsSystem.instance.enable = false;
    this._paiInWorld.clear();

    //回收场上牌
    let count = length;
    for(let i = 0; i < length ;i++){
      let node = childs[i];
      let pos = node.position;
      let time = pos.length()/40.0;
      tween().target(node).to(time,{ position: new Vec3(0, pos.y, 0)})
      .call(()=>{
        this._paiRands.push(node.name);
        this.putNode(node);//回收

        if(--count <= 0){
          this.faPai();
        }
      }).start();
    }
      
  }
  


  /*抓牌，磁铁吸若干个*/
  zhuaPai(){
 
    let count = 0;
    let times = 2;
    let selects = [];
    this._paiInWorld.forEach((nodes:Array<Node>)=>{
      if(nodes.length >= 3){
        if(count < 3*times){
          count+=3; 
          selects.push(nodes.pop());
          selects.push(nodes.pop());
          selects.push(nodes.pop());
        }
      }
    });

    // childs.sort((a:Node,b:Node)=>b.position.y-a.position.y);

    //开始吸牌    
    for(let i = count - 1 ;i >= 0;i--){
      let node = selects[i];
      this.enablePhysics(node,false);
      let time = node.position.length()/20.0;
      tween().target(node).to(time , { position: new Vec3(0, 10, 0)},{easing:"quartIn"})
      .call(()=>{
        this.putNode(node);
        if(--count == 0){
            //结束吸牌
        }
      }).start();
    }
  }

  /*退牌*/
  tuiPai(){
    adManager.showRewardedVideoAd();
    let end  = this._paiSelets.length - 1;
    if(end >= 0){
      let nodes = this._paiSelets[end];
      let node = nodes.pop();
      if( node ){
        this._paiSelectCount--;
        if(nodes.length == 0) this._paiSelets.pop();

        tween().target(node).to(0.2,{ position: new Vec3((end-3)*3, 15, 0)},{easing:"quartOut"})
        .call(()=>{
          this.putNode(node);
          let n = this.getPai(node.name);
          let body = n.getComponent(RigidBody);
          body.setLinearVelocity(new Vec3(0,-2,0));
          n.scale = this._level >0? Vec3.ONE:new Vec3(1.25,1.25,1.25);
        }).start();

      }
    }

  }

  /* 发牌*/
  faPai(){

    this._locked = true;
    PhysicsSystem.instance.enable = true;

    //首次发牌
    if( this._level == 0){
      for(let i = 0;true;i++){ 
        let node = this.getPai();
        if( !node ) break;
        // node.scale = new Vec3(1.25,1.25,1.25);
        node.position = new Vec3(((i%3)-1)*8,1,((~~(i/3))-1)*10);
        node.rotation = Quat.fromAxisAngle(new Quat(),Vec3.UNIT_Y,Math.random()*Math.PI/6);
      }
      this._locked = false;
      return;
    }

    let inc = 0;
    let step = 15;
    let angle = 0;
    let radius = 3;
    let velocity = 30;

    const animation = ()=>{
      let node = this.getPai();
      if( !node ){
        this.unschedule(animation);
        this._locked = false;
        //发牌结束
        return;
      }
    
      let x = Math.cos(angle);
      let z = Math.sin(angle);
      let y = 1.0+(inc++/10.0)*0.5;
      node.position = new Vec3(x*radius,y,z*radius);

      let body = node.getComponent(RigidBody);
      body.setLinearVelocity(new Vec3(x*velocity,0,z*velocity));
      this.scheduleOnce(()=>{ body.angularDamping = 0.8;},this._config.DampTime);
      body.angularDamping = 1;

      angle+=step*Math.PI/180.0;
    }

    this.schedule(animation ,0.03);
  }
}


