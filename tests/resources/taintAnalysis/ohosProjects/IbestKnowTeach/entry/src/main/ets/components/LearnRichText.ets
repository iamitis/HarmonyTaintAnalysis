@Component
export struct LearnRichText {
  // 富文本
  @Prop richTextContent: string = ""

  build() {
    Scroll() {
      RichText(`
                      <html>
                        <body>
                          <div style="font-size:54px">${this.richTextContent}</div>
                        <body>
                      </html>
                      `)
    }
    .layoutWeight(1)

  }
}