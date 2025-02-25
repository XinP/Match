export class RewardedVideoAd {
    private adUnitId: string;
    private ad: tt.RewardedVideoAd | null;
    private isLoaded: boolean;
    private onLoadCallback?: () => void;
    private onErrorCallback?: (error: any) => void;
    private onCloseCallback?: (isEnded: boolean) => void;

    constructor(adUnitId) {
      this.adUnitId = adUnitId;
      this.ad = null;
      this.isLoaded = false;
      this.init();
    }
  
    // 初始化广告
    init() {
      this.ad = tt.createRewardedVideoAd({ adUnitId: this.adUnitId });
  
      // 监听广告加载成功事件
      this.ad.onLoad(() => {
        this.isLoaded = true;
        this.onLoadCallback && this.onLoadCallback();
      });
  
      // 监听广告加载失败事件
      this.ad.onError(err => {
        this.isLoaded = false;
        this.onErrorCallback && this.onErrorCallback(err);
      });
  
      // 监听广告关闭事件
      this.ad.onClose(res => {
        this.isLoaded = false;
        if (res && res.isEnded) {
          // 广告正常播放结束
          this.onCloseCallback && this.onCloseCallback(true);
        } else {
          // 广告未播放结束
          this.onCloseCallback && this.onCloseCallback(false);
        }
      });
    }
  
    // 预加载广告
    preload() {
      if (this.ad) {
        this.ad.load();
      }
    }
  
    // 播放广告
    show() {
      if (this.isLoaded) {
        this.ad.show();
      } else {
        console.warn('广告未加载完成，请先预加载广告');
        this.onErrorCallback && this.onErrorCallback({ message: '广告未加载完成' });
      }
    }
  
    // 设置广告加载成功回调
    setOnLoadCallback(callback) {
      this.onLoadCallback = callback;
    }
  
    // 设置广告加载失败回调
    setOnErrorCallback(callback) {
      this.onErrorCallback = callback;
    }
  
    // 设置广告关闭回调
    setOnCloseCallback(callback) {
      this.onCloseCallback = callback;
    }
  
    // 销毁广告
    destroy() {
      if (this.ad) {
        this.ad.destroy();
        this.ad = null;
        this.isLoaded = false;
      }
    }
  }
  
  // 使用示例
  const adUnitId = 'ad_unit_id';
  const rewardedAd = new RewardedVideoAd(adUnitId);
  
  // 设置回调
  rewardedAd.setOnLoadCallback(() => {
    console.log('广告加载成功');
  });
  
  rewardedAd.setOnErrorCallback(err => {
    console.error('广告加载失败', err);
  });
  
  rewardedAd.setOnCloseCallback(isEnded => {
    if (isEnded) {
      console.log('广告播放完成，给予奖励');
    } else {
      console.log('广告未播放完成，不给予奖励');
    }
  });
  
  // 预加载广告
  rewardedAd.preload();
  
  // 播放广告
  rewardedAd.show();