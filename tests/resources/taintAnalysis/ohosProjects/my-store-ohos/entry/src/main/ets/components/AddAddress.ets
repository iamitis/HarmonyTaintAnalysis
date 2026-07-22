import { promptAction, router } from '@kit.ArkUI';

// 导入代码二中的API函数
import { addAddressInfo, AddressInfo, login, register, ResponInfo, User } from '../api/UserApi';
import { GenericResponse } from '../utils/RequestUtil';
import { currUser } from '../pages/LoginPage';

@Preview
@Entry
@CustomDialog
export struct AddAddress {
  controller?: CustomDialogController;
  @State btnMsg: string = '保存地址'; //
  @State province: string = ''; //省
  @State city: string = ''; // 市
  @State block: string = ''; // 区
  @State detialAddress: string = ''; // 详细地址
  @State receiver: string = ''; // 收件人
  @State phone: string = '';
  @State area: string[] = [];
  onFinished?: () => void;

  build() {

    Column() {
      TextInput({ placeholder: '省' })
        .inputStyle()
        .onChange((value: string) => {
          this.province = value;
        })
      Line().lineStyle()
      TextInput({ placeholder: '市' })
        .inputStyle()
        .onChange((value: string) => {
          this.city = value;
        })
      Line().lineStyle()
      TextInput({ placeholder: '区' })
        .inputStyle()
        .onChange((value: string) => {
          this.block = value;
        })
      Line().lineStyle()
      TextInput({ placeholder: '详细地址' })
        .inputStyle()
        .onChange((value: string) => {
          this.detialAddress = value;
        })
      Line().lineStyle()
      TextInput({ placeholder: '收件人称呼' })
        .inputStyle()
        .onChange((value: string) => {
          this.receiver = value;
        })
      Line().lineStyle()
      TextInput({ placeholder: '联系方式' })
        .type(InputType.PhoneNumber)
        .inputStyle()
        .onChange((value: string) => {
          this.phone = value;
        })
      Line().lineStyle()
      Button(this.btnMsg)
        .width('80%')
        .margin({ top: 100 })
        .height(50)
        .onClick(async () => { // 使用async函数以便进行API调用
          if (this.province === '' || this.province === undefined) {
            AlertDialog.show({
              message: "请输入省",
              autoCancel: true,
            });
            return;
          }
          if (this.city === '' || this.city === undefined) {
            AlertDialog.show({
              message: "请输入市",
              autoCancel: true,
            });
            return;
          }
          if (this.receiver === '' || this.receiver === undefined) {
            AlertDialog.show({
              message: "请输入收件人称呼",
              autoCancel: true,
            });
            return;
          }
          if (this.phone === '' || this.phone === undefined) {
            AlertDialog.show({
              message: "请输入联系方式",
              autoCancel: true,
            });
            return;
          }
          // 调用添加API
          try {
            this.area.push(this.province, this.city, this.block)
            const address: AddressInfo = {
              userId: currUser.id!,
              areaAddress: this.area,
              detailAddress: this.detialAddress,
              phone: this.phone,
              receiver: this.receiver,
              isDefault: false
            }
            const response = await addAddressInfo(address);
            const parsedResponse = JSON.parse(response.toString()!) as GenericResponse<AddressInfo>;
            promptAction.showToast({message: '添加成功'})
            console.info('添加成功');
            // 调用onFinished
            if (this.onFinished) {
              this.onFinished();
            }
          } catch (error) {
            console.error('添加失败', error);
            AlertDialog.show({
              message: "添加失败，请稍后再试",
              autoCancel: true,
            });
          }
        })
    }
    .width('100%')
    .padding({ top: 15, bottom: 15 })
  }
}

// TextInput组件的自定义样式扩展
@Extend(TextInput)
function inputStyle() {
  .placeholderColor(Color.Gray) // 占位符颜色
  .height(50) // 输入框高度
  .fontSize(15) // 字体大小
  .backgroundColor(0xF1F3F5) // 背景颜色
  .width('90%') // 宽度为父组件的100%
  .margin(10)
}

// Line组件的自定义样式扩展
@Extend(Line)
function lineStyle() {
  .width('100%') // 宽度为父组件的100%
  .height(1) // 高度
  .backgroundColor(0xF1F3F5) // 背景颜色
}