import { Orders } from './Orders'
import { AddressPage } from './AddressPage'
import { router } from '@kit.ArkUI';
import { logout } from '../api/UserApi';
import { currUser } from './LoginPage';
import { GenericResponse } from '../utils/RequestUtil';

export let userTabsController: TabsController = new TabsController();

@Component
export struct UserPage {
  @State currIndex: number = 0;

  build() {
    Stack() {
      Tabs({ barPosition: BarPosition.Start, controller: userTabsController }) {
        TabContent() {
          Orders({ currTabIndex: this.currIndex })
        }.tabBar('我的订单')

        TabContent() {
          AddressPage()
        }.tabBar('地址管理')
      }.scrollable(false)
      .onChange((index: number) => {
        this.currIndex = index;
      })

      Column() {
        Image($r('app.media.logout'))
          .width(20).height(20)
        Text('log out').fontColor(Color.Gray).fontSize(10)
      }.position({ top: 15, right: 10 })
      .onClick(async () => {
        const response = await logout(currUser.id!);
        if (response) {
          const parsedResponse = JSON.parse(response.toString()!) as GenericResponse<boolean>;
          if (parsedResponse.code === '000') {
            router.pushUrl({
              url: "pages/LoginPage"
            });
          }
        }
      })
    }
  }
}