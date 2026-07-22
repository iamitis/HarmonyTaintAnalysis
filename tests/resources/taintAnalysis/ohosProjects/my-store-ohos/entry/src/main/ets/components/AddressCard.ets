import { AddressInfo, deleteAddressInfo } from '../api/UserApi';
import { promptAction } from '@kit.ArkUI';
import { GenericResponse } from '../utils/RequestUtil';

@Component
export struct AddressCard {
  @Prop address: AddressInfo;
  @Prop index: number;
  @State backColor: string = '#ffffff';
  handleRemoved?: () => void;
  @State canRemoved: boolean = true;

  // handleEdit?: (index: number) => void;
  build() {
    if (this.address) {
      Row({ space: 10 }) {
        Image($r('app.media.ic_statusbar_gps'))
          .width(30).height(30)
          .onTouch((event: TouchEvent) => {
            if (event.type === TouchType.Down) {
              this.backColor = '#ffd9d9d9';
            } else if (event.type === TouchType.Up) {
              this.backColor = '#ffffff';
            }
          })

        Column({ space: 5 }) {
          Text(this.address.areaAddress.join(' '))
            .fontColor('#ff605f5f')
            .width('100%')
          Text(this.address.detailAddress)
            .fontSize(18)
            .fontWeight(FontWeight.Bold)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .width('100%')
          Row({ space: 10 }) {
            Text(this.address.receiver)
              .fontColor('#ff605f5f')
            Text(this.address.phone)
              .fontColor('#ff605f5f')
          }.width('100%')
        }.width('75%')
        .onTouch((event: TouchEvent) => {
          if (event.type === TouchType.Down) {
            this.backColor = '#ffd9d9d9';
          } else if (event.type === TouchType.Up) {
            this.backColor = '#ffffff';
          }
        })

        if (this.canRemoved) {
          Button({ buttonStyle: ButtonStyleMode.TEXTUAL }) {
            Image($r('app.media.ic_public_delete')).height(20).width(20)
          }.height(30).width(30)
          .onClick(() => this.handledeleteAddress())
        }
      }.width('100%')
      .backgroundColor(this.backColor)
    }
  }

  async handledeleteAddress() {
    let id = 0;
    if (this.address.addressInfoId) {
      id = this.address.addressInfoId;
    }
    const response = await deleteAddressInfo(id);
    if (response) {
      let parsedResponse = JSON.parse(response.toString()!) as GenericResponse<boolean>;
      if (parsedResponse.code === '000') {
        promptAction.showToast({ message: '已删除！' })
        if (this.handleRemoved) {
          this.handleRemoved();
        }
      } else {
        promptAction.showToast({ message: '删除失败！' })
      }
    }
  }
}


