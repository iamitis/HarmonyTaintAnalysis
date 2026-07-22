import { CommonConstant } from '../../contants/CommonConstant';
import { IBestDialog } from "@ibestservices/ibest-ui"
import userApi from '../../api/UserApi';
import { PreferencesUtil } from '../../utils/PreferencesUtil';
import { UserInfo } from '../../api/UserApi.type';
import { FileUtil } from '../../utils/FileUtil';
import { showToast } from '../../utils/Toast';
import { emitter, request } from '@kit.BasicServicesKit';
import { FileData } from '../../models/FileData';
import { common } from '@kit.AbilityKit';
import { Logger } from '../../utils/Logger';
import { ProgressDialog } from '../../components/ProgressDialog';

let context = getContext(this) as common.UIAbilityContext;


@Entry
@Component
struct MineInfo {
  // 个人信息昵称
  @State inputNicknameValue: string = ''
  // 输入框是否报错
  @State formInputError: boolean = false
  // 弹出框是否展示
  @State dialogVisible: boolean = false
  // 用户信息
  @StorageLink(CommonConstant.USER_INFO) userInfo: UserInfo = {
    nickname: '',
    account: '',
    avatarUri: '',
    id: 0
  }
  // 自定义上传进度弹窗
  dialog: CustomDialogController = new CustomDialogController({
    builder: ProgressDialog({ message: `上传进度: 0%` }),
    customStyle: true,
    alignment: DialogAlignment.Center
  })

  aboutToAppear() {
    // 获取用户信息
    const userInfo = AppStorage.get<UserInfo>(CommonConstant.USER_INFO);
    if (userInfo?.account) {
      this.userInfo = userInfo
    }
  }

  /**
   * 修改头像
   */
  async editAvatar() {
    try {
      // 头像上传
      const uri = await FileUtil.selectImage()
      if (!uri) {
        showToast("选择图片失败")
        return
      }
      // 将uri截取转换成固定类型
      const fileData = FileUtil.convertFile(uri)
      // 将用户文件转换成缓存目录
      const data = await FileUtil.copyUserFileToCache(uri, fileData)
      if (!data) {
        showToast("修改头像失败")
        return
      }
      // 上传文件
      await this.uploadImage(fileData)
    } catch (error) {
      showToast("修改头像失败")
    }

  }

  /**
   * 上传图片
   */

  async uploadImage(fileData: FileData) {
    let files: Array<request.File> = [
    // uri前缀internal://cache 对应cacheDir目录
      {
        filename: fileData.fileFullName,
        name: 'file', // 文件上传的key
        uri: 'internal://cache/' + fileData.fileFullName,
        type: fileData.fileSuffix
      }
    ]
    let uploadConfig: request.UploadConfig = {
      url: 'http://118.31.50.145:9003/v1/user/editAvatar',
      header: {
        "Authorization": AppStorage.get<string>("token")
      },
      method: 'POST',
      files: files,
      data: []
    }
    // 打开上传进度弹窗
    this.dialog.open()
    // 发送请求
    const response = await request.uploadFile(context, uploadConfig)
    // 监听上传进度
    response.on("progress", async (val, size) => {
      Logger.info("头像上传进度:", `${val / size * 100}%`)
      emitter.emit({ eventId: 100 }, { data: { process: `上传进度: ${(val / size * 100).toFixed(0)}%` } })
      if (val === size) {
        this.dialog.close()
        showToast('头像上传成功')
        // 获取用户信息
        const userInfo = await userApi.getUserInfo();
        this.userInfo = userInfo
        // 存放用户数据
        AppStorage.setOrCreate(CommonConstant.USER_INFO, userInfo)
        PreferencesUtil.savaData(CommonConstant.PREFERENCES_NAME, CommonConstant.USER_INFO,
          JSON.stringify(userInfo))
      }
    })

  }

  @Builder
  formInputContain() {
    Column() {
      TextInput({ 'placeholder': '请输入新的昵称,长度不能超过50字符', text: this.userInfo.nickname })
        .fontSize(14)
        .placeholderFont({ size: 14 })
        .onChange((value) => {
          this.inputNicknameValue = value;
          this.formInputError = false
        })
      if (this.formInputError) {
        Text('昵称不能为空')
          .width(CommonConstant.WIDTH_FULL)
          .textAlign(TextAlign.Start)
          .margin({
            top: 5,
            left: 5
          })
          .fontColor(Color.Red)
          .fontSize($r('app.float.common_font_size_small'))
          .transition({ type: TransitionType.Insert, opacity: 1 })
          .transition({ type: TransitionType.Delete, opacity: 0 })
      }

    }.width('90%').margin({ top: 15, bottom: 15 })
  }

  build() {
    Navigation() {
      Column() {
        IBestDialog({
          visible: $dialogVisible,
          title: "修改用户昵称",
          showCancelButton: true,
          defaultBuilder: (): void => this.formInputContain(),
          beforeClose: async (action) => {
            if (action === 'cancel') {
              return true
            }
            const valueLength = this.inputNicknameValue.trim().length;
            this.formInputError = !valueLength;
            if (!this.formInputError) {
              // 更新用户个人信息
              await userApi.editNickname({ nickname: this.inputNicknameValue })
              showToast('更新用户昵称成功')
              // 获取用户信息
              const userInfo = await userApi.getUserInfo();
              this.userInfo = userInfo
              // 存放用户数据
              AppStorage.setOrCreate(CommonConstant.USER_INFO, userInfo)
              PreferencesUtil.savaData(CommonConstant.PREFERENCES_NAME, CommonConstant.USER_INFO,
                JSON.stringify(userInfo))
              return true
            }
            return !this.formInputError
          }
        })
        Row() {
          Text('头像')
            .fontSize($r('app.float.common_font_size_medium'))
            .fontWeight(FontWeight.Medium)
          Row({ space: 10 }) {
            Image(this.userInfo.avatarUri)
              .width(30).aspectRatio(1)
              .objectFit(ImageFit.Auto)
              .borderRadius(15)
            Image($r('app.media.icon_arrow'))
              .width(15).aspectRatio(1)
          }.onClick(() => {
            // 上传头像
            this.editAvatar()
          })
        }
        .width(CommonConstant.WIDTH_FULL)
        .justifyContent(FlexAlign.SpaceBetween)
        .backgroundColor($r('app.color.common_white'))
        .height($r('app.float.common_height_small'))
        .padding(10)
        .borderRadius(5)

        Divider().strokeWidth(1).color('#DDDDDD')

        Row() {
          Text('昵称')
            .fontSize($r('app.float.common_font_size_medium'))
            .fontWeight(FontWeight.Medium)
          Row({ space: 10 }) {
            if (this.userInfo.nickname.length > 10) {
              Text(this.userInfo.nickname.substring(0, 10) + '...')
                .textStyles()
            } else {
              Text(this.userInfo.nickname)
                .textStyles()
            }
            Image($r('app.media.icon_arrow'))
              .width(15).aspectRatio(1)
          }
          .onClick(() => {
            this.dialogVisible = true
          })
        }
        .width(CommonConstant.WIDTH_FULL)
        .justifyContent(FlexAlign.SpaceBetween)
        .backgroundColor($r('app.color.common_white'))
        .height($r('app.float.common_height_small'))
        .padding(10)
        .borderRadius(5)

      }.width(CommonConstant.WIDTH_FULL)
      .padding($r('app.float.common_padding'))
    }
    .height(CommonConstant.HEIGHT_FULL)
    .width(CommonConstant.WIDTH_FULL)
    .title($r('app.string.mine_info_title'))
    .titleMode(NavigationTitleMode.Mini)
    .mode(NavigationMode.Stack)
    .backgroundColor($r('app.color.background_color_gray'))
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
  }
}


@Extend(Text)
function textStyles() {
  .fontColor($r('app.color.common_gray'))
  .fontSize($r('app.float.common_font_size_small'))
  .maxLines(1)
  .textOverflow({ overflow: TextOverflow.Ellipsis })
}
