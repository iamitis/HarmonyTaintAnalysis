import { common } from '@kit.AbilityKit';
import fs from '@ohos.file.fs';
import request from '@ohos.request';
import { BusinessError } from '@ohos.base';
import { picker } from '@kit.CoreFileKit';
import { Logger } from './Logger';
import { FileData } from '../models/FileData';

let context = getContext(this) as common.UIAbilityContext;
let filesDir = context.filesDir
let cacheDir = context.cacheDir

export class FileUtil {
  /**
   * 判断文件是否存在
   */
  static isExist(fileName: string, fileSuffix: string) {
    // 判断文件是否存在，存在就删除
    let path = filesDir + '/' + fileName + '.' + fileSuffix;
    if (fs.accessSync(path)) {
      fs.unlinkSync(path);
    }
  }

  /**
   * 下载文件
   */
  static downloadFile(fileName: string, fileSuffix: string, fileUrl: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      // 判断文件是否已存在
      FileUtil.isExist(fileName, fileSuffix)
      request.downloadFile(context, {
        url: fileUrl,
        filePath: filesDir + '/' + fileName + '.' + fileSuffix
      }).then((downloadTask: request.DownloadTask) => {
        downloadTask.on('complete', () => {
          resolve(true)
        })
      }).catch((err: BusinessError) => {
        console.error(`Invoke downloadTask failed, code is ${err.code}, message is ${err.message}`);
        reject(err)
      });
    })
  }

  /**
   * 选择图片
   */
  static selectImage(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      try {
        let photoSelectOptions = new picker.PhotoSelectOptions();
        photoSelectOptions.MIMEType = picker.PhotoViewMIMETypes.IMAGE_TYPE;
        photoSelectOptions.maxSelectNumber = 1;
        let photoPicker = new picker.PhotoViewPicker(context);
        photoPicker.select(photoSelectOptions).then((photoSelectResult: picker.PhotoSelectResult) => {
          resolve(photoSelectResult.photoUris[0])
        }).catch((err: BusinessError) => {
          reject(err)
        });
      } catch (error) {
        let err: BusinessError = error as BusinessError;
        console.error('PhotoViewPicker failed with err: ' + JSON.stringify(err));
        reject(err)
      }
    })
  }


  /**
   * 将uri截取转换成固定类型
   */
  static convertFile(uri: string): FileData {
    // 将uri分割成字符串数组
    const array: string[] = uri.split('/');
    // 获取用户文件全名
    const fileFullName = array[array.length-1]
    // 获取文件名字里面.最后出现的索引位置
    let index = fileFullName.lastIndexOf(".");
    // 获取文件后缀名
    const fileSuffix = fileFullName.substring(index + 1)
    // 获取文件名
    const fileName = fileFullName.substring(0, index)
    // 封装文件数据
    const fileData: FileData = { fileFullName: fileFullName, fileSuffix: fileSuffix, fileName: fileName }
    return fileData
  }


  /**
   * 将用户文件转换成缓存目录
   */
  static copyUserFileToCache(uri: string, fileData: FileData): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      // 缓存目录
      let cachePath = cacheDir + '/' + fileData.fileFullName
      try {
        let files = fs.openSync(uri, fs.OpenMode.READ_ONLY)
        fs.copyFileSync(files.fd, cachePath)
        resolve(true)
      } catch (error) {
        let err: BusinessError = error as BusinessError;
        Logger.error('Error copying file:' + JSON.stringify(err))
        reject(err)
      }
    })
  }
}