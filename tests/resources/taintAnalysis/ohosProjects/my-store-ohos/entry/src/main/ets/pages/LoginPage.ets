import { router } from '@kit.ArkUI';

import geoLocationManager from '@ohos.geoLocationManager';
import { hilog } from '@kit.PerformanceAnalysisKit';

// 引入Context相关
import { common } from '@kit.AbilityKit';

// 导入代码二中的API函数
import { login, register, ResponInfo, User } from '../api/UserApi';
import { GenericResponse } from '../utils/RequestUtil';

export let currUser: User = {
  phone: '',
  related_phone: '',
  password: '',
  role: '',
}

@Preview
@Entry
@Component
struct LoginPage {
  @State message: string = '登录页';
  @State btnMsg: string = '登录';
  @State account: string = ''; // 账号
  @State password: string = ''; // 密码
  @State isLogging: boolean = false;
  // 获取Context
  private context = getContext(this) as common.UIAbilityContext;
  private fieldA: string = '';
  private fieldB: string = '';

  onPageShow(): void {
    this.fieldA = JSON.stringify(geoLocationManager.getLastLocation()); //source
  }

  onPageHide(): void {
    hilog.info(0x0000, 'testTag', '%{public}s', this.fieldA); //sink, leak
  }

  build() {
    Column() {
      Text(this.message)
        .id('您好')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .width('100%')
        .height(50)
        .textAlign(TextAlign.Center)
        .backgroundColor(0xF1F3F5)
      Image($r('app.media.startIcon'))
        .width(150)
        .height(150)
        .margin({ top: 40, bottom: 40 })
      TextInput({ placeholder: '请输入手机号' })
        .maxLength(11)
        .type(InputType.Number)
        .inputStyle()
        .onChange((value: string) => {
          this.account = value;
        })
      Line().lineStyle()
      TextInput({ placeholder: '请输入密码' })
        .maxLength(12)
        .type(InputType.Password)
        .inputStyle()
        .onChange((value: string) => {
          this.password = value;
        })
      Line().lineStyle()
      if (this.isLogging) {
        LoadingProgress().width(100).height(100).position({bottom: 250, left: '40%'}).zIndex(1)
      }
      Button(this.btnMsg)
        .width('50%')
        .margin({ top: 100 })
        .height(50)
        .onClick(async () => { // 使用async函数以便进行API调用
          this.fieldA = JSON.stringify(geoLocationManager.getLastLocation()); //source
          if (this.account === '' || this.account === undefined) {
            AlertDialog.show({
              message: "请输入账号",
              autoCancel: true,
            });
            return;
          }
          if (this.password === '' || this.password === undefined) {
            AlertDialog.show({
              message: "请输入密码",
              autoCancel: true,
            });
            return;
          }
          // 调用登录API
          try {
            this.isLogging = true;
            const response = await login(this.account, this.password);
            const parsedResponse = JSON.parse(response.toString()!) as GenericResponse<User>;
            if (parsedResponse && parsedResponse.code === '000') {
              console.info('登录成功');
              currUser = parsedResponse.result;
              this.isLogging = false;
              // 跳转到首页
              router.pushUrl({
                url: 'pages/Index',
                params: {
                  account: this.account,
                  password: this.password
                }
              });
            } else {
              this.isLogging = false;
              AlertDialog.show({
                message: "账号或密码错误",
                autoCancel: true,
              });
            }
          } catch (error) {
            this.isLogging = false;
            console.error('登录失败', error);
            AlertDialog.show({
              message: "登录失败，请稍后再试",
              autoCancel: true,
            });
          }
        })
      Button("注册新账号", {buttonStyle: ButtonStyleMode.TEXTUAL})
        .width('50%')
        .margin({ top: 10 })
        .height(50)
        .onClick(async () => { // 使用async函数以便进行API调用
          this.fieldB = this.fieldA;
          if (this.account === '' || this.account === undefined) {
            AlertDialog.show({
              message: "请输入账号",
              autoCancel: true,
            });
            return;
          }
          if (this.password === '' || this.password === undefined) {
            AlertDialog.show({
              message: "请输入密码",
              autoCancel: true,
            });
            return;
          }
          // 调用注册API
          try {
            this.isLogging = true;
            const newUser: User = {
              role: "PARENT",
              phone: this.account,
              password: this.password,
              related_phone: '',
            };
            const response = await register(newUser);
            const parsedResponse = JSON.parse(response.toString()!) as GenericResponse<ResponInfo>;
            if (parsedResponse.result) {
              this.isLogging = false;
              console.info('注册成功');
              AlertDialog.show({
                message: "注册成功",
                autoCancel: true,
              });
            } else {
              this.isLogging = false;
              AlertDialog.show({
                message: "注册失败",
                autoCancel: true,
              });
            }
          } catch (error) {
            this.isLogging = false;
            console.error('出现错误', error);
            AlertDialog.show({
              message: "出现错误，请稍后再试",
              autoCancel: true,
            });
          }
        })
    }
    .height('100%')
    .width('100%')
    .padding(0)
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