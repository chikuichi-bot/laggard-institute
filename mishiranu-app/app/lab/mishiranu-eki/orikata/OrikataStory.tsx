import Image from "next/image";
import Link from "next/link";
import "./orikata.css";

const shots = [
  {
    src: "/story/orikata/land-fujinomori.png",
    alt: "見知らぬ駅の土地ページ。藤森駅の土地案内と読み上げ",
    title: "降りる前に、どんな土地か読める",
    body: "駅ごとに、土地の成り立ちや駅前の様子を書いています。読み上げもできるので、電車の中でイヤホンで聞いておくと、降りたときに少し景色の見え方が変わります。",
  },
  {
    src: "/story/orikata/map-yodo.png",
    alt: "見知らぬ駅の地図ページ。淀駅周辺の徒歩圏と番号付きの動線",
    title: "地図は、歩ける範囲だけ",
    body: "載せているのは駅から歩いて行ける場所だけです。位置を確かめられたものしか出さないようにしていて、回る順番は番号で振っています。",
  },
  {
    src: "/story/orikata/arrive-yodo.png",
    alt: "見知らぬ駅の到着確認。ここは淀駅です",
    title: "まず「ここは○○駅です」",
    body: "開くと、いまいる駅を最初に確かめます。知らない駅で降りると、それだけで案外ほっとするものです。",
  },
] as const;

export default function OrikataStory() {
  return (
    <div className="orikata">
      <div className="orikata-shell">
        <header className="orikata-hero">
          <p className="orikata-brand">見知らぬ駅</p>
          <h1 className="orikata-title">見知らぬ駅の降り方</h1>
          <p className="orikata-lede">
            名前は知っているのに、一度も降りたことのない駅。誰にでもいくつかあると思います。このアプリは、そういう駅でふらっと降りてみるために作りました。
          </p>
          <div className="orikata-hero-phone">
            <Image
              src="/story/orikata/land-fujinomori.png"
              alt="見知らぬ駅の土地案内画面"
              width={780}
              height={1688}
              priority
              sizes="260px"
            />
          </div>
        </header>

        <main>
          <section className="orikata-section">
            <p className="orikata-kicker">作ったきっかけ</p>
            <h2 className="orikata-h2">気になるのに、降りたことがない</h2>
            <p className="orikata-prose">
              電車に乗っていると、毎日のように通り過ぎるだけの駅があります。ちょっと気になってはいても、わざわざ降りることはまずありません。
            </p>
            <p className="orikata-prose">
              降りてみようかと思ったことは何度かあります。でも、いざ調べると、出てくるのは少し離れた有名な観光地か、チェーン店くらい。駅を出て右に行けばいいのか左に行けばいいのか、それすらわからない。結局そのまま乗っていってしまいます。
            </p>
            <p className="orikata-prose">
              行ってみたい気持ちはあるんです。足りないのは、
              <strong>駅を出てからの最初の一時間ぶんの情報</strong>
              でした。それを手元に置けるようにしたのが、見知らぬ駅です。
            </p>
          </section>

          <section className="orikata-section">
            <p className="orikata-kicker">ネットで調べても出てこない</p>
            <h2 className="orikata-h2">情報には、ずいぶん偏りがある</h2>
            <p className="orikata-prose">
              いまは何でもネットで調べられる、と言われます。たしかに有名な場所なら、写真も口コミもいくらでも出てきます。ところが、小さな駅の周りとなると、驚くほど何も出てきません。
            </p>
            <p className="orikata-prose">
              知られている場所ほど書かれ、書かれるほどまた人が行く。その一方で、行く人の少ない場所は、いつまでも書かれないままです。情報の量が、場所によってこんなに違ってしまっている。「情報の非対称」と言われるものですが、駅のホームに立つと、それを肌で感じます。
            </p>
            <div className="orikata-split">
              <article className="orikata-panel">
                <h3>よく出てくる場所</h3>
                <p>
                  ランキングに載る観光地、写真の多いお店、予約サイトに並ぶ宿。もともと知られているところに、さらに情報が積み上がっていきます。
                </p>
              </article>
              <article className="orikata-panel orikata-panel--lit">
                <h3>ほとんど出てこない場所</h3>
                <p>
                  小さな駅の前の商店、近所の人が通う食堂、川沿いのベンチ。地元の人にとっては当たり前でも、外から来た人にはまず見つけられません。
                </p>
              </article>
            </div>
            <p className="orikata-prose" style={{ marginTop: "1.15rem" }}>
              見知らぬ駅で扱いたいのは、こちらの「出てこない」ほうです。日本中の名所を並べるつもりはありません。
              <strong>いま降りた駅から歩いて行けるところ</strong>
              だけを、文章と地図にしています。
            </p>
          </section>

          <section className="orikata-section">
            <p className="orikata-kicker">アプリの中身</p>
            <h2 className="orikata-h2">名所がなくても、歩けば何かある</h2>
            <p className="orikata-prose">
              有名な観光地がない駅でも、歩いてみると、古い神社や味のある喫茶店、ひと休みできる川べりが見つかったりします。そういうものを、駅ごとに集めています。
            </p>
            <div className="orikata-gallery">
              {shots.map((shot) => (
                <figure className="orikata-shot" key={shot.src}>
                  <div className="orikata-phone">
                    <Image
                      src={shot.src}
                      alt={shot.alt}
                      width={780}
                      height={1688}
                      sizes="230px"
                    />
                  </div>
                  <figcaption className="orikata-shot__copy">
                    <h3>{shot.title}</h3>
                    <p>{shot.body}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className="orikata-section">
            <p className="orikata-kicker">使い方</p>
            <h2 className="orikata-h2">降りるまでと、降りてから</h2>
            <ol className="orikata-steps">
              <li>
                <span>01</span>
                <div>
                  <strong>駅を選ぶ</strong>
                  <p>現在地から探すか、駅名を入れます。</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>土地の話を読む・聞く</strong>
                  <p>どんなところか、ざっと知っておきます。電車の中で聞いておくのがちょうどいいです。</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>地図を見る</strong>
                  <p>歩いて行ける場所と、回る順番を確かめます。</p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <strong>寄り道する</strong>
                  <p>見どころ、ご飯、お土産、休むところ。気が向いたものから行ってみてください。</p>
                </div>
              </li>
            </ol>
          </section>

          <section className="orikata-section orikata-closing">
            <p className="orikata-kicker">おわりに</p>
            <h2 className="orikata-h2">
              <Image
                className="orikata-icon"
                src="/story/orikata/app-icon.png"
                alt=""
                width={80}
                height={80}
              />
              次の駅で、降りてみませんか
            </h2>
            <p className="orikata-prose">
              駅の名前だけ知っていても、その町のことはわかりません。川の音がどのくらい近いか、駅前の店がどんな感じか、どこまでなら歩けそうか。知りたいのは、たいていそういうことです。
            </p>
            <p className="orikata-prose">
              ネットにはなかなか出てこないそういう話を、駅のホームで開ける場所に置いておきたい。そう思って、少しずつ駅を増やしています。
            </p>
            <Link className="orikata-cta" href="/lab/mishiranu-eki">
              アプリを開く
              <small>見知らぬ駅</small>
            </Link>
          </section>

          <p className="orikata-foot">Lagado · 見知らぬ駅の降り方</p>
        </main>
      </div>
    </div>
  );
}
