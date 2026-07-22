import { emitter } from '@kit.BasicServicesKit'

@CustomDialog
export struct ProgressDialog {
  @State message: string = ''
  controller: CustomDialogController

  aboutToAppear(): void {
    emitter.on({ eventId: 100 }, (res) => {
      this.message = res.data!["process"]
    })
  }

  build() {
    Flex({ direction: FlexDirection.Row, alignItems: ItemAlign.Center, justifyContent: FlexAlign.Center }) {
      LoadingProgress().width(30).height(30).color($r('app.color.common_white'))
      if (this.message) {
        Text(this.message).fontSize((14)).fontColor($r('app.color.common_white'))
      }
    }
    .width($r('app.float.common_width_huge'))
    .height($r('app.float.common_height_small'))
    .padding(10)
    .backgroundColor('rgba(0,0,0,0.5)')
    .borderRadius(8)
  }
}