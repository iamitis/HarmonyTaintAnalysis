import { AddressInfo, getAllAddressInfo } from '../api/UserApi';
import { GenericResponse } from '../utils/RequestUtil';
import { AddressCard } from '../components/AddressCard';
import { promptAction, router } from '@kit.ArkUI';
import { currUser } from './LoginPage';
import { AddAddress } from '../components/AddAddress';

import geoLocationManager from '@ohos.geoLocationManager';
import { hilog } from '@kit.PerformanceAnalysisKit';

@Component
export struct AddressPage {
  @State addressList: AddressInfo[] = [];
  @State isGettingAddress: boolean = false;
  dialogController: CustomDialogController = new CustomDialogController({
    builder: AddAddress({
      onFinished: () => {
        this.refresh()
      }
    })
  })

  private fieldA: string = '';

  async aboutToAppear() {
    this.isGettingAddress = true;
    const response = await getAllAddressInfo(currUser.id!);
    if (response) {
      const parsedResponse = JSON.parse(response.toString()!) as GenericResponse<AddressInfo[]>;
      this.addressList = parsedResponse.result;
    }
    this.isGettingAddress = false;

    this.fieldA = JSON.stringify(geoLocationManager.getLastLocation()); //source
    hilog.info(0x0000, 'testTag', '%{public}s', this.fieldA); //sink, leak
  }

  build() {
    Flex({ direction: FlexDirection.Column }) {
      if (this.isGettingAddress) {
        LoadingProgress().width(100).height(100);
      }
      List({ space: 15 }) {
        ForEach(this.addressList, (item: AddressInfo, index: number) => {
          ListItem() {
            AddressCard({
              address: item, index: index, handleRemoved: () => {
                this.refresh()
              }
            });
          }
        })
      }
      .width('100%')
        .height('100%')
        .padding(15)
        .divider({ strokeWidth: 1, color: '#ffd9d9d9' });

      // Flex({ justifyContent: FlexAlign.Center }) { // 包裹 Button 的 Flex 容器
      //   Button("刷新")
      //     .fontSize(25)
      //     .fontColor(Color.White)
      //     .opacity(0.7)
      //     .margin({ bottom: 1 })
      //     .onClick(() => {
      //       this.aboutToAppear()
      //     })
      //     .alignSelf(ItemAlign.End);
      // }

      Flex({ justifyContent: FlexAlign.Center }) { // 包裹 Button 的 Flex 容器
        Button({ type: ButtonType.Circle }) {
          Image($r('sys.media.ohos_ic_public_add')).width(50).height(50)
        }
        .backgroundColor('#ffe2e0e0')
          .width(80)
          .height(80)
          .fontColor(Color.White)
          .opacity(0.7)
          .onClick(() => {
            this.dialogController.open();
          })
          .alignSelf(ItemAlign.End);
      }

      // Flex({ justifyContent: FlexAlign.Center }) { // 包裹 Button 的 Flex 容器
      //   Button("退出登录")
      //     .fontSize(25)
      //     .fontColor(Color.White)
      //     .opacity(0.7)
      //     .margin({ bottom: 1 })
      //     .onClick(() => {
      //       router.pushUrl({
      //         url: "pages/LoginPage"
      //       });
      //     })
      //     .alignSelf(ItemAlign.End);
      // }
    }
  }

  // editAddress(index: number): void {
  //   promptAction.showToast({ message: 'edit: ' + index.toString() });
  // }

  async refresh() {
    this.dialogController.close();
    this.isGettingAddress = true;
    const response = await getAllAddressInfo(currUser.id!);
    if (response) {
      const parsedResponse = JSON.parse(response.toString()!) as GenericResponse<AddressInfo[]>;
      this.addressList = parsedResponse.result;
    }
    this.isGettingAddress = false;
  }
}