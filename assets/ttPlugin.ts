import { sys } from 'cc';
import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

const TTAdUnitId = 'tt-ad-unit-id';

@ccclass('AdManager')
export class AdManager {
    private static instance ?: AdManager;
    public globalData = {
        adCounts: 0,
    };
    constructor(){
        if(AdManager.instance){
            throw new Error("请通过AdManager实例访问!");
        }
        AdManager.instance = this;
        if(window.tt){
            console.log('now is in tt');
        }
        else{
            console.log('not in tt ');
        } 
    };
    ///后续可能需添加参数
    public showRewardedVideoAd(rewardFunc){
        if(window.tt){
            console.log('show rewardVideo ad...');
            try{
                const videoAd = tt.createRewardedVideoAd({
                    adUnitId:TTAdUnitId,
                    //再得广告先设为false，后续开启
                    multiton: false,
                });
                videoAd.show().then(()=>{
                    console.log('tt视频广告展示');
                });
                videoAd.onClose(res=>{
                    if(res.isEnded()){
                        rewardFunc();
                        //需向服务器发送广告id和时间戳。

                    }
                    else{
                        //这里要根据实操判断是否要添加弹窗提醒用户继续观看
                        console.log('观看未完成');
                    }
                });
                videoAd.onError(err=>{
                    console.error('广告错误:', err.errCode, err.errMsg);
                });

            }
            catch{

            }
        }
        else{
            console.log('not in tt, show rewardedVideo Ad failed!');
            return true;
        }
        return false;
    }
};

@ccclass('StorageManager')
export class PlatformUtils {
    static GetStorageData(key){
        if(window.tt){
            return tt.getStorageSync(key);
        }
        else{
            return JSON.parse(sys.localStorage.getItem(key));
        }
    }
    static SaveStorageData(key, value){
        if(window.tt){
            tt.setStorageSync(key, JSON.stringify(value));
        }
        else{
           sys.localStorage.setItem(key, JSON.stringify(value));
        }
    }
}
export const adManager = new AdManager();


