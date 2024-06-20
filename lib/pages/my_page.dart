import 'package:flutter/material.dart';

class MyPage extends StatelessWidget {
  const MyPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('マイページ')),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0), // 余白を追加
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Image.network(
                    'https://w7.pngwing.com/pngs/631/477/png-transparent-instragram-logo.png',
                    width: 100,
                    height: 100,
                  ),
                  const Spacer(),
                  const Column(
                    children: [
                      Text(
                        '7.841',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      Text('投稿'),
                    ],
                  ),
                  const SizedBox(width: 10),
                  const Column(
                    children: [
                      Text(
                        '4.6億',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      Text('フォロワー'),
                    ],
                  ),
                  const SizedBox(width: 10),
                  const Column(
                    children: [
                      Text(
                        '99',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      Text('フォロー'),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text(
                'Instagram User',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const Text(
                '#YoursToMake',
                style: TextStyle(
                  color: Colors.blue,
                ),
              ),
              const Text(
                'Help/instantgram.com',
                style: TextStyle(
                  color: Colors.blue,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  OutlinedButton(
                    onPressed: () {},
                    child: const Text('フォロー中'),
                    style: OutlinedButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8), // ボタン間のスペースを追加
                  OutlinedButton(
                    onPressed: () {},
                    child: const Text('メッセージ！！！'),
                    style: OutlinedButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8), // ボタン間のスペースを追加
                  OutlinedButton(
                    onPressed: () {},
                    child: const Icon(Icons.arrow_drop_down),
                    style: OutlinedButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                primary: false,
                crossAxisSpacing: 3,
                mainAxisSpacing: 3,
                crossAxisCount: 3,
                children: const <Widget>[
                  InstagramItem(
                    imageUrl: 'images/IMG_0924.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/14174853.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/230562a7e7392e8063f7a73e95d97a03.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/IMG_0924.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/14174853.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/230562a7e7392e8063f7a73e95d97a03.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/IMG_0924.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/14174853.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/230562a7e7392e8063f7a73e95d97a03.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/IMG_0924.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/14174853.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/230562a7e7392e8063f7a73e95d97a03.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/IMG_0924.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/14174853.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/230562a7e7392e8063f7a73e95d97a03.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/IMG_0924.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/14174853.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/230562a7e7392e8063f7a73e95d97a03.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/IMG_0924.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/14174853.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/230562a7e7392e8063f7a73e95d97a03.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/IMG_0924.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/14174853.jpg',
                  ),
                  InstagramItem(
                    imageUrl: 'images/230562a7e7392e8063f7a73e95d97a03.jpg',
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class InstagramItem extends StatelessWidget {
  const InstagramItem({super.key, required this.imageUrl});

  final String imageUrl;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      imageUrl,
    );
  }
}

void main() {
  runApp(const MaterialApp(
    home: MyPage(),
  ));
}
