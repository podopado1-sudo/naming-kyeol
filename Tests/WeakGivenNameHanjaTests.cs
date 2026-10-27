using System.Linq;
using NameForm.Application.Engines.Data;
using NameForm.Application.Engines.Utils;
using Xunit;

namespace NameForm.Tests;

/// <summary>
/// WeakGivenNameHanjaSet(359자) 회귀 테스트 — 감점 세트의 HanjaData 이관 + 확장.
/// weak는 배제가 아니라 감점: 동음 대안이 있을 때만 양보한다.
/// </summary>
public class WeakGivenNameHanjaTests
{
    [Theory]
    [InlineData("友")] // 벗 우 (기존 14자 대표)
    [InlineData("雨")] // 비 우
    [InlineData("西")] // 서녘 서
    [InlineData("紙")] // 종이 지
    public void LegacySet_StillWeak(string ch)
    {
        Assert.True(HanjaData.IsWeakGivenNameHanja(ch));
    }

    [Theory]
    [InlineData(0x2F9A3)] // 菜 호환 보충 — 사전 원본에 별도 항목으로 있던 호환형(2026-10-22 기준 14자)
    [InlineData(0xF974)]  // 若 호환
    [InlineData(0xF910)]  // 蘿 호환
    public void CompatCodepoint_WeakViaNfkc(int codepoint)
    {
        // IsForbiddenNameHanja 와 같은 NFKC 폴백 — 세트에는 통합 한자만 두고 호환형은 정규형으로 조회.
        // 정수 코드포인트: 호환 한자 리터럴은 편집기 NFC 정규화로 통합 한자로 바뀐 회귀 전력이 있다.
        var compat = char.ConvertFromUtf32(codepoint);
        Assert.NotEqual(compat, compat.Normalize(System.Text.NormalizationForm.FormKC));
        Assert.True(HanjaData.IsWeakGivenNameHanja(compat.Normalize(System.Text.NormalizationForm.FormKC)));
        Assert.True(HanjaData.IsWeakGivenNameHanja(compat));
    }

    [Theory]
    [InlineData("菜")] // 나물 채 (확장분 대표)
    [InlineData("枷")] // 도리깨 가
    [InlineData("焉")] // 어찌 언 (허사)
    [InlineData("腸")] // 창자 장 (신체 범속)
    [InlineData("倉")] // 곳집 창
    [InlineData("商")] // 장사 상 — 대표 훈 정정 후 후속 검토 (尙常相祥 대안)
    [InlineData("貨")] // 재물 화 — 화 음절 점유 아티팩트 (平貨→平和)
    [InlineData("暈")] // 무리 훈 — 훈/운 음절 점유 아티팩트 (在暈→才訓)
    public void ExpandedSet_IsWeak(string ch)
    {
        Assert.True(HanjaData.IsWeakGivenNameHanja(ch));
    }

    [Theory]
    [InlineData("咳")] // 기침 해 — 7/02 대표 훈 교정 뒤 해웅=咳雄으로 노출 (2026-10-07 라이브 실측)
    [InlineData("煂")] // 불태울 혁 — 준혁=俊煂 등 12쌍
    [InlineData("烋")] // 효 자리 훈 '거들먹거릴'(대법원 효·휴 겸용) — 효리=烋李가 1순위였음
    [InlineData("降")] // 항 자리 훈 '항복할'
    public void LiveAudit20261007_IsWeak(string ch)
    {
        Assert.True(HanjaData.IsWeakGivenNameHanja(ch));
        Assert.False(HanjaData.IsForbiddenNameHanja(ch));
    }

    [Theory]
    [InlineData("帆")] // 돛 범 — 자원오행 전환 뒤 범준·경범 등 공개 16명 1순위 (2026-10-22 S6-2 두더지 1라운드)
    [InlineData("柯")] // 가지 가 — 가온 1순위
    [InlineData("豆")] // 콩 두 — 荳(콩 두)와 같은 곡물 훈
    [InlineData("鹿")] // 사슴 록 — 초록 대표 뜻 '처음 마주한 순수한 사슴의'
    [InlineData("必")] // 반드시 필 (허사) — 승필 '반드시 이기고야 마는'
    [InlineData("復")] // 부 자리 '다시'
    [InlineData("契")] // 설 자리 '사람 이름' — 은설=恩契가 계 자리 '맺을' 뜻으로 윤문됨
    [InlineData("附")] // 붙을 부 — 2라운드(復 뒤 부겸·부영 1순위)
    [InlineData("返")] // 돌이킬 반 — 2라운드(半 뒤 반희 1순위)
    public void MoleAudit20261022_IsWeak(string ch)
    {
        Assert.True(HanjaData.IsWeakGivenNameHanja(ch));
        Assert.False(HanjaData.IsForbiddenNameHanja(ch));
    }

    [Fact]
    public void MoleAudit20261022_DrownIsForbidden()
    {
        // 溺(빠질 닉·오줌 뇨) — 2라운드에 라익 4순위 빈칸으로 승격된 명백 부정자. weak 가 아니라 불용.
        Assert.True(HanjaData.IsForbiddenNameHanja("溺"));
        Assert.False(HanjaData.IsWeakGivenNameHanja("溺"));
    }

    [Theory]
    [InlineData("이안", "male")]   // 李眼(눈 안)이 4칸 채우기로 노출되던 이름
    [InlineData("태휘", "none")]   // 胎輝(아이 밸 태)
    [InlineData("새라", "female")] // 鰓羅(아가미 새)·愢羅(마음 맞지 않을 새)
    [InlineData("해웅", "male")]   // 咳雄
    [InlineData("준혁", "male")]   // 俊煂
    [InlineData("효리", "female")] // 烋李
    [InlineData("범준", "male")]   // 帆俊 (2026-10-22 S6-2)
    [InlineData("은설", "female")] // 恩契
    [InlineData("초록", "female")] // 初鹿
    [InlineData("반희", "female")] // 半熙 → 返熙 (2라운드)
    [InlineData("부겸", "male")]   // 附謙 (2라운드)
    public void SelectCombos_DropsWeakPairs_WhenCleanPairExists(string name, string gender)
    {
        var combos = HanjaSelector.SelectCombos(name, gender, 4);
        Assert.NotEmpty(combos);
        Assert.All(combos, c => Assert.False(
            HanjaData.IsWeakGivenNameHanja(c.First) || HanjaData.IsWeakGivenNameHanja(c.Second),
            $"{name}: 약자 조합 {c.First}{c.Second} — 약자 없는 조합이 있으면 빈칸 채우기로 쓰지 않는다"));
    }

    [Fact]
    public void SelectCombos_KeepsWeakPairs_WhenSyllableHasNoAlternative()
    {
        // '녀'는 후보가 女(weak)뿐 — 약자 쌍만 남아도 combos를 비우지 않는다(weak는 배제가 아니라 양보).
        var combos = HanjaSelector.SelectCombos("가녀", "none", 4);
        Assert.NotEmpty(combos);
        Assert.All(combos, c => Assert.Equal("女", c.Second));
    }

    [Theory]
    [InlineData("禾")] // 벼 화 — 결실·풍요 (경계 24자: 의도적 미포함)
    [InlineData("錐")] // 송곳 추 — 낭중지추
    [InlineData("鯉")] // 잉어 리 — 등용문
    [InlineData("襟")] // 옷깃 금 — 흉금·금도
    [InlineData("宇")] // 집 우 — 좋은 이름 한자가 오염되지 않았는지
    [InlineData("瑞")] // 상서 서
    public void PositiveOrBorderline_NotWeak(string ch)
    {
        Assert.False(HanjaData.IsWeakGivenNameHanja(ch));
    }

    [Fact]
    public void SelectorShim_DelegatesToHanjaData()
    {
        Assert.True(HanjaSelector.IsWeakGivenNameHanja("雨"));
        Assert.False(HanjaSelector.IsWeakGivenNameHanja("宇"));
    }

    [Theory]
    [InlineData("菜")]
    [InlineData("焉")]
    [InlineData("倉")]
    public void WeakAndForbidden_AreDisjoint(string ch)
    {
        // weak(감점)와 forbidden(배제)은 상호 배타 정책 — 스캔 단계에서 불용 제외 후 선정.
        Assert.False(HanjaData.IsForbiddenNameHanja(ch));
    }

    [Theory]
    [InlineData("우")] // 友·雨 대신 宇·佑·祐 등
    [InlineData("채")] // 菜 대신 彩·採 등
    [InlineData("창")] // 倉 대신 昌·彰 등
    public void Select_YieldsToNonWeakAlternative(string syllable)
    {
        var picked = HanjaSelector.Select(syllable, "none", null, null, null);
        Assert.Single(picked);
        Assert.NotNull(picked[0]);
        Assert.False(HanjaData.IsWeakGivenNameHanja(picked[0]!.Character),
            $"'{syllable}' 대표로 약한 한자 {picked[0]!.Character} 선택됨 — 대안 존재 시 양보해야");
    }

    // ── 2026-10-26 B1 재생성 두더지 검수 — 인명용 목록에 data-naver.csv 를 더해(관련도 +500) 새로 오른 글자 ──
    // 정수 코드포인트로 적는다(이 블록은 B1 회귀 테스트와 같은 표기)

    private static string Cp(int codepoint) => char.ConvertFromUtf32(codepoint);

    [Theory]
    [InlineData(0x5F29)] // 弩 쇠뇌 노 — 노아=弩亞 등 /name 5쌍 (무기 사물, 銃 선례)
    [InlineData(0x7A4F)] // 穏 편안할 온 — 穩의 일본 신자체, 온찬·휘온 4순위 (稳 간체 선례)
    [InlineData(0x8166)] // 腦 골 뇌 — 뇌(남) /evaluate 1순위가 雷에서 바뀜 (신체 훈)
    [InlineData(0x91B2)] // 醲 진한 술 농 — 농(none·용신 金) 1순위가 瓏에서 바뀜
    [InlineData(0x77D1)] // 矑 눈동자 로 — 2라운드(弩 뒤 노(none·여, 용신 木) 1순위, 眸 선례)
    [InlineData(0x7B2F)] // 笯 새장 노 — 2라운드(矑 뒤 같은 칸)
    public void MoleAudit20261026_IsWeak(int codepoint)
    {
        Assert.True(HanjaData.IsWeakGivenNameHanja(Cp(codepoint)));
        Assert.False(HanjaData.IsForbiddenNameHanja(Cp(codepoint)));
    }

    [Fact]
    public void MoleAudit20261026_MaidservantIsForbidden()
    {
        // 妮(계집종 니) — 婢(계집종 비)·奴(종 노)와 같은 '천함' 부류. /name 9쌍(다니=茶妮·채니=彩妮 등)에 올랐다
        Assert.True(HanjaData.IsForbiddenNameHanja(Cp(0x59AE)));
        Assert.False(HanjaData.IsWeakGivenNameHanja(Cp(0x59AE)));
    }

    [Theory]
    [InlineData("노아", "male")]   // 弩亞
    [InlineData("노은", "female")] // 弩恩
    [InlineData("온찬", "male")]   // 穏燦
    [InlineData("휘온", "male")]   // 輝穏
    public void MoleAudit20261026_SelectCombos_DropsNewWeakPairs(string name, string gender)
    {
        var combos = HanjaSelector.SelectCombos(name, gender, 4);
        Assert.NotEmpty(combos);
        Assert.All(combos, c => Assert.False(
            HanjaData.IsWeakGivenNameHanja(c.First) || HanjaData.IsWeakGivenNameHanja(c.Second),
            $"{name}: 약자 조합 {c.First}{c.Second}"));
    }

    [Theory]
    [InlineData("다니", "female")] // 茶妮
    [InlineData("채니", "female")] // 彩妮
    [InlineData("지니", "female")] // 智妮
    public void MoleAudit20261026_SelectCombos_NoMaidservant(string name, string gender)
    {
        var combos = HanjaSelector.SelectCombos(name, gender, 4);
        Assert.NotEmpty(combos);
        Assert.DoesNotContain(combos, c => c.Second == Cp(0x59AE));
    }

    [Theory]
    [InlineData("뇌", "male", null, 0x96F7)]   // 雷 우레 — 腦(골)가 아니라
    [InlineData("뇌", "none", "水", 0x96F7)]   // 雷
    [InlineData("농", "none", "金", 0x74CF)]   // 瓏 옥 소리 — 醲(진한 술)가 아니라
    [InlineData("니", "female", "土", 0x999C)] // 馜 진한 향기 — 妮(계집종)가 아니라
    [InlineData("노", "none", "木", 0x6488)]   // 撈 건질 — 弩·矑·笯 다음(부정 훈 아님, 여기서 멈춤)
    [InlineData("노", "none", null, 0x7490)]   // 璐 아름다운 옥 — B1 로 努 이 인명용 목록에 들어 앞섰지만, 2026-10-27 성별 규칙 감사로 努 '힘쓸'이
                                               // Neutral 이 되어 관련도 '성별 있음 +5'를 잃었다(璐 Female). 두 글자 모두 부정 훈 아님
    public void MoleAudit20261026_SelectPicks(string syllable, string gender, string? yongshin, int expected)
    {
        var picked = HanjaSelector.Select(syllable, gender, yongshin, null, null);
        Assert.Single(picked);
        Assert.Equal(Cp(expected), picked[0]!.Character);
    }

    // ── 2026-10-26 B6 보완 두더지 검수 — /evaluate 배정 격자(희신·기신 포함)를 HEAD 와 대조, 4라운드 수렴 + /name 재생성 E 목록 ──

    [Theory]
    [InlineData(0x60D3)] // 惓 삼갈/싫증날 권 — 김권우(남·土) 勸 뒤 1순위
    [InlineData(0x65AF)] // 斯 이 사/천할 사 — 허사, 박사랑(여·金) 事 뒤 1순위
    [InlineData(0x545D)] // 呝 닭 소리 액
    [InlineData(0x559E)] // 喞 두런거릴 즉
    [InlineData(0x8AE0)] // 諠 지껄일 훤
    [InlineData(0x892A)] // 褪 바랠 퇴
    [InlineData(0x6799)] // 枙 옹이 와 (부훈 재앙 액 — 첫 훈 기준이라 weak)
    [InlineData(0x6CD0)] // 泐 돌 갈라질 륵
    [InlineData(0x6312)] // 挒 비틀 렬 — 광렬·동렬·은렬 조합
    [InlineData(0x5393)] // 厓 언덕 애 (崖 이체)
    [InlineData(0x5D15)] // 崕 언덕 애 (崖 이체)
    [InlineData(0x7F94)] // 羔 새끼 양
    [InlineData(0x9DFF)] // 鷿 논병아리
    [InlineData(0x514E)] // 兎 토끼
    [InlineData(0x5154)] // 兔 토끼
    [InlineData(0x515C)] // 兜 투구 — 두찬·두혁 조합
    [InlineData(0x945E)] // 鑞 땜납
    [InlineData(0x52FF)] // 勿 말 물 — 물결 조합
    [InlineData(0x808B)] // 肋 갈빗대 (2라운드)
    [InlineData(0x98B2)] // 颲 사나운 바람 (2라운드)
    [InlineData(0x50FB)] // 僻 궁벽할 (2라운드)
    [InlineData(0x522A)] // 刪 깎을 (2라운드)
    [InlineData(0x8435)] // 萵 상추 (2라운드)
    [InlineData(0x8344)] // 荄 풀뿌리 (2라운드) — 해랑·해웅·해찬 조합
    [InlineData(0x5277)] // 剷 깎을 (3라운드)
    [InlineData(0x9178)] // 酸 실 (3라운드)
    [InlineData(0x5EE8)] // 廨 공해 (3라운드)
    [InlineData(0x91F5)] // 釵 비녀 (4라운드)
    [InlineData(0x59DF)] // 姟 백 조 (/name E)
    [InlineData(0x675C)] // 杜 막을 (/name E)
    [InlineData(0x6793)] // 枓 두공 (/name E)
    [InlineData(0x4F85)] // 侅 이상할 (/name E)
    [InlineData(0x5B69)] // 孩 어린아이 (/name E — 兒 선례)
    public void MoleAudit20261026B6_IsWeak(int codepoint)
    {
        Assert.True(HanjaData.IsWeakGivenNameHanja(Cp(codepoint)));
        Assert.False(HanjaData.IsForbiddenNameHanja(Cp(codepoint)));
    }

    [Theory]
    [InlineData(0x6239)] // 戹 좁을 액/재앙 액 — 狹·阨·厄 선례
    [InlineData(0x8A1B)] // 訛 그릇될 와 — 誤 선례
    [InlineData(0x75D8)] // 痘 역질 두 — 疫·疹 선례
    public void MoleAudit20261026B6_IsForbidden(int codepoint)
    {
        Assert.True(HanjaData.IsForbiddenNameHanja(Cp(codepoint)));
        Assert.False(HanjaData.IsWeakGivenNameHanja(Cp(codepoint)));
    }

    [Theory]
    [InlineData("동렬", "male", 0x6312)]   // 東挒 → 비틀 렬 없음
    [InlineData("광렬", "male", 0x98B2)]   // 光颲 → 사나운 바람 렬 없음
    [InlineData("해찬", "male", 0x8344)]   // 荄燦 → 풀뿌리 해 없음
    [InlineData("두혁", "male", 0x515C)]   // 兜赫 → 투구 두 없음
    [InlineData("물결", "none", 0x52FF)]   // 勿潔 → 말 물 없음
    public void MoleAudit20261026B6_SelectCombos_DropsNewWeak(string name, string gender, int codepoint)
    {
        var combos = HanjaSelector.SelectCombos(name, gender, 4);
        Assert.NotEmpty(combos);
        Assert.DoesNotContain(combos, c => c.First == Cp(codepoint) || c.Second == Cp(codepoint));
        Assert.All(combos, c => Assert.False(
            HanjaData.IsWeakGivenNameHanja(c.First) || HanjaData.IsWeakGivenNameHanja(c.Second),
            $"{name}: 약자 조합 {c.First}{c.Second}"));
    }

    // ── 2026-10-26 운영 검증 부정 훈 정리 — 최항준(남)=桁(차꼬)·/analysis 후보 犴·蠢·旱·嗽 제보 뒤 전 독음 덤프
    //    (/evaluate 배정 격자 = 독음 × 성별 3 × 생년월일 없음·용신 5(희신·기신 포함), /name-analysis 표시 상위 10) 3라운드 + /name 재생성 E 1라운드 ──
    // 분류 근거(선례)는 HanjaData.cs 불용 9차·weak 같은 날 블록. 정수 코드포인트로 적는다

    [Theory]
    [InlineData(0x6841)] // 桁 형구 — 囚·刑 선례(차꼬 = 형구)
    [InlineData(0x72B4)] // 犴 짐승·감옥 — 犬·狗·狴(감옥) 선례
    [InlineData(0x65F1)] // 旱 재앙 — 災·渴 선례(가뭄)
    [InlineData(0x8822)] // 蠢 어리석음 — 憃·蟲 선례(어리석을·벌레)
    [InlineData(0x777E)] // 睾 신체 부정 — 尿·膀·胱 선례(배설·생식 기관)
    [InlineData(0x99D1)] // 駑 어리석음 — 鈍·騃 선례(둔할)
    [InlineData(0x865C)] // 虜 도둑 — 擄 선례(노략질·사로잡을)
    [InlineData(0x688F)] // 梏 형구 — 囚·刑 선례(수갑)
    [InlineData(0x684E)] // 桎 형구 — 囚·刑 선례(차꼬)
    [InlineData(0x91F1)] // 釱 형구 — 囚·刑 선례(차꼬)
    [InlineData(0x8F5E)] // 轞 형구 — 囚 선례(함거 = 죄인 수레)
    [InlineData(0x5709)] // 圉 감옥 — 圄·囹 선례(감옥 어)
    [InlineData(0x61F2)] // 懲 형벌 — 罰·刑 선례(징계할)
    [InlineData(0x75A5)] // 疥 병 — 瘡·疣 선례(옴)
    [InlineData(0x7668)] // 癨 병 — 病·瘡 선례(곽란)
    [InlineData(0x75B8)] // 疸 병 — 病 선례(황달)
    [InlineData(0x7630)] // 瘰 병 — 瘡 선례(연주창)
    [InlineData(0x7667)] // 癧 병 — 瘡 선례(연주창)
    [InlineData(0x75F3)] // 痳 병 — 病 선례(임질)
    [InlineData(0x7655)] // 癕 병 — 瘡 선례(악창)
    [InlineData(0x7670)] // 癰 병 — 瘡 선례(악창)
    [InlineData(0x7648)] // 癈 병 — 病 선례(고질병)
    [InlineData(0x7665)] // 癥 병 — 病 선례(적취)
    [InlineData(0x75C7)] // 症 병 — 病 선례(증세)
    [InlineData(0x760B)] // 瘋 병 — 狂·病 선례(두풍·미칠)
    [InlineData(0x7600)] // 瘀 병 — 病 선례(어혈질)
    [InlineData(0x7599)] // 疙 병 — 瘡 선례(쥐부스럼)
    [InlineData(0x7643)] // 癃 병 — 疲·瘁 선례(느른할·고질병)
    [InlineData(0x6B91)] // 殑 죽음 — 殞·殆 선례(까무러칠)
    [InlineData(0x6901)] // 椁 죽음 — 冢·殮 선례(덧널 = 관)
    [InlineData(0x69E8)] // 槨 죽음 — 冢·殮 선례(외관)
    [InlineData(0x7A80)] // 窀 죽음 — 墓·塚 선례(광중 = 무덤 구덩이)
    [InlineData(0x9099)] // 邙 죽음 — 墓·塚 선례(북망산 = 무덤)
    [InlineData(0x7A86)] // 窆 죽음 — 葬 선례(하관할)
    [InlineData(0x7FE3)] // 翣 죽음 — 葬·絰 선례(불삽 = 상여 장식)
    [InlineData(0x7E17)] // 縗 죽음 — 絰 선례(상복)
    [InlineData(0x9AFD)] // 髽 죽음 — 絰 선례(북상투 = 상중 머리)
    [InlineData(0x6B89)] // 殉 죽음 — 死 선례(따라 죽을)
    [InlineData(0x6BB2)] // 殲 죽음 — 殺·戮 선례(다 죽일)
    [InlineData(0x6B8D)] // 殍 죽음 — 餓·死 선례(주려 죽을)
    [InlineData(0x794A)] // 祊 죽음 — 祭 선례(제사)
    [InlineData(0x81B0)] // 膰 죽음 — 祭 선례(제사 고기)
    [InlineData(0x993D)] // 餽 죽음 — 祭 선례(제사 지낼)
    [InlineData(0x6E8F)] // 溏 더러움 — 淖·泥 선례(진창)
    [InlineData(0x6FD8)] // 濘 더러움 — 淖·泥 선례(진창)
    [InlineData(0x9709)] // 霉 더러움 — 腐·朽 선례(곰팡이)
    [InlineData(0x7C95)] // 粕 더러움 — 滓·渣 선례(지게미)
    [InlineData(0x884A)] // 衊 더러움 — 汚 선례(더럽힐)
    [InlineData(0x5113)] // 儓 천함 — 僕·隷 선례(하인)
    [InlineData(0x61E6)] // 懦 천함 — 弱 선례(나약할)
    [InlineData(0x5B71)] // 孱 천함 — 弱 선례(잔약할)
    [InlineData(0x5122)] // 儢 어리석음 — 怠·惰 선례(힘쓰지 아니할)
    [InlineData(0x7A84)] // 窄 천함 — 狹 선례(좁을)
    [InlineData(0x8CB6)] // 貶 천함 — 低·蔑 선례(낮출)
    [InlineData(0x8D9C)] // 趜 가난 — 困 선례(곤궁할)
    [InlineData(0x5226)] // 刦 도둑 — 劫 선례(겁탈할 — 劫의 이체)
    [InlineData(0x5227)] // 刧 도둑 — 劫 선례(겁탈할 — 劫의 이체)
    [InlineData(0x527D)] // 剽 도둑 — 劫 선례(겁박할)
    [InlineData(0x62D0)] // 拐 도둑 — 掠·擄 선례(후릴 = 유괴)
    [InlineData(0x4FD8)] // 俘 도둑 — 擄 선례(사로잡을)
    [InlineData(0x8CC2)] // 賂 범죄 — 罪·犯 선례(뇌물)
    [InlineData(0x8A51)] // 詑 거짓 — 詐·欺 선례(속일)
    [InlineData(0x8A43)] // 詃 거짓 — 誑·誆 선례(꾈)
    [InlineData(0x8ADC)] // 諜 거짓 — 覘·窺 선례(염탐할)
    [InlineData(0x8B1E)] // 謞 거짓 — 奸 선례(간특할)
    [InlineData(0x509D)] // 傝 악 — 惡 선례(나쁠)
    [InlineData(0x5FD2)] // 忒 잘못 — 誤·訛 선례(틀릴)
    [InlineData(0x9006)] // 逆 잘못 — 叛·違 선례(거스를)
    [InlineData(0x6096)] // 悖 잘못 — 叛·戾 선례(거스를)
    [InlineData(0x5F88)] // 很 잘못 — 戾 선례(패려궂을)
    [InlineData(0x8FEB)] // 迫 포악 — 虐 선례(핍박할)
    [InlineData(0x8A10)] // 訐 비방 — 詆·誹 선례(들추어낼)
    [InlineData(0x6353)] // 捓 비방 — 嘲 선례(야유할)
    [InlineData(0x5A9F)] // 媟 교만 — 嫚·慢 선례(버릇없이 굴)
    [InlineData(0x5B32)] // 嬲 문란 — 姦·淫 선례(희롱할)
    [InlineData(0x722D)] // 爭 다툼 — 鬩·鬪 선례(다툴)
    [InlineData(0x6230)] // 戰 다툼 — 鬪 선례(싸움)
    [InlineData(0x9D06)] // 鴆 재앙 — 毒 선례(짐새 = 독조)
    [InlineData(0x8831)] // 蠱 재앙 — 蟲·呪 선례(뱃속벌레·고독)
    [InlineData(0x6BC0)] // 毀 훼손 — 壞·損 선례(헐)
    [InlineData(0x6BC1)] // 毁 훼손 — 壞·損 선례(헐 — 毀의 이체)
    [InlineData(0x5F0A)] // 弊 훼손 — 敝 선례(폐단·해질)
    [InlineData(0x584C)] // 塌 훼손 — 崩·坍 선례(무너질)
    [InlineData(0x511C)] // 儜 고통 — 苦 선례(괴로워할)
    [InlineData(0x61AF)] // 憯 슬픔 — 慘 선례(비통할)
    [InlineData(0x615F)] // 慟 슬픔 — 哀·悲 선례(서러워할)
    [InlineData(0x606B)] // 恫 슬픔 — 悼·傷 선례(상심할)
    [InlineData(0x6B38)] // 欸 슬픔 — 嘆·歎 선례(한숨 쉴)
    [InlineData(0x54BB)] // 咻 고통 — 嗚·哽 선례(신음 소리)
    [InlineData(0x5992)] // 妒 감정 — 妬 선례(강샘할 — 妬의 이체)
    [InlineData(0x8127)] // 脧 신체 부정 — 尿·膀·胱 선례(불알)
    [InlineData(0x81A3)] // 膣 신체 부정 — 尿·膀·胱 선례(음도)
    [InlineData(0x77C7)] // 矇 신체 부정 — 盲 선례(청맹과니)
    [InlineData(0x7707)] // 眇 신체 부정 — 盲 선례(애꾸눈)
    [InlineData(0x778E)] // 瞎 신체 부정 — 盲 선례(애꾸눈)
    [InlineData(0x79BF)] // 禿 신체 부정 — 跛·佝 선례(대머리)
    [InlineData(0x77EE)] // 矮 신체 부정 — 佝·跛 선례(난쟁이)
    [InlineData(0x54BC)] // 咼 신체 부정 — 跛·蹇 선례(입 비뚤어질)
    [InlineData(0x7278)] // 牸 신체 부정 — 雌 선례(암소)
    [InlineData(0x86E3)] // 蛣 짐승 — 蚊·蛆 선례(장구벌레)
    [InlineData(0x8839)] // 蠹 짐승 — 蟲 선례(좀)
    [InlineData(0x867B)] // 虻 짐승 — 蚊·蠅 선례(등에)
    [InlineData(0x87CA)] // 蟊 짐승 — 蟲 선례(해충)
    [InlineData(0x8765)] // 蝥 짐승 — 蟲 선례(해충)
    [InlineData(0x9D42)] // 鵂 짐승 — 鶹·梟 선례(수리부엉이)
    [InlineData(0x8C56)] // 豖 짐승 — 豕 선례(발 얽은 돼지 걸음)
    [InlineData(0x9EF7)] // 黷 더러움 — 汚 선례(더럽힐)
    [InlineData(0x77BD)] // 瞽 신체 부정 — 盲 선례(맹인)
    [InlineData(0x5AEB)] // 嫫 신체 부정 — 醜 선례(추녀)
    [InlineData(0x63F6)] // 揶 비방 — 嘲·捓 선례(야유할)
    [InlineData(0x8DCC)] // 跌 훼손 — 蹶·躓 선례(거꾸러질)
    [InlineData(0x6658)] // 晘 재앙 — 旱 선례(가물)
    public void NegGloss20261026_IsForbidden(int codepoint)
    {
        Assert.True(HanjaData.IsForbiddenNameHanja(Cp(codepoint)));
        Assert.False(HanjaData.IsWeakGivenNameHanja(Cp(codepoint)));
    }

    [Theory]
    [InlineData(0x55FD)] // 嗽 — 咳 선례(기침)
    [InlineData(0x6B2C)] // 欬 — 咳 선례(기침)
    [InlineData(0x5476)] // 呶 — 喧·諠 선례(지껄일)
    [InlineData(0x5542)] // 啂 — 乳 선례(젖)
    [InlineData(0x5C3B)] // 尻 — 臀 선례(볼기)
    [InlineData(0x4FBF)] // 便 — 降 선례(독음별 훈 — 변 자리 '똥오줌', 편 자리 '편할')
    [InlineData(0x5FD3)] // 忓 — 降 선례(독음별 훈 — 간 자리 '방해할', 한 자리 '아름다울')
    [InlineData(0x7006)] // 瀆 — 枙 선례(첫 훈 '도랑', 부훈 '더럽힐' — 첫 훈 기준이라 불용 아님)
    [InlineData(0x6DEA)] // 淪 — 熄·泄 선례(빠질)
    [InlineData(0x634F)] // 捏 — 飾 선례(꾸밀)
    [InlineData(0x57CB)] // 埋 — 葬 은 불용이나 '묻을'은 매장·매립 겸용(약자)
    [InlineData(0x580B)] // 堋 — 埋 와 같은 훈(묻을)
    [InlineData(0x7164)] // 煤 — 煙 선례(그을음)
    [InlineData(0x711A)] // 焚 — 煂 선례(불사를)
    [InlineData(0x71D4)] // 燔 — 煂 선례(불사를)
    [InlineData(0x7207)] // 爇 — 煂 선례(불사를)
    [InlineData(0x522E)] // 刮 — 削·刪 선례(깎을)
    [InlineData(0x7357)] // 獗 — 颲 선례(날뛸)
    [InlineData(0x614A)] // 慊 — 愢 선례(찐덥지 않을)
    [InlineData(0x8D8C)] // 趌 — 嚇 선례(성내어 달릴)
    [InlineData(0x4FD6)] // 俖 — 非 선례(옳지 못할)
    [InlineData(0x5F17)] // 弗 — 不 선례(아닐 — 허사)
    [InlineData(0x7953)] // 祓 — 賽 선례(푸닥거리할)
    [InlineData(0x8A1F)] // 訟 — 諷 선례(송사할)
    [InlineData(0x8B6B)] // 譫 — 喧 선례(헛소리)
    [InlineData(0x7FEB)] // 翫 — 玩 선례(희롱할)
    [InlineData(0x620E)] // 戎 — 弩·兜 선례(병장기)
    [InlineData(0x67D9)] // 柙 — 檻 선례(우리)
    [InlineData(0x58C5)] // 壅 — 杜 선례(막을)
    [InlineData(0x5616)] // 嘖 — 喧 선례(들렐)
    [InlineData(0x546B)] // 呫 — 囁·喞 선례(소곤거릴)
    [InlineData(0x558B)] // 喋 — 喧 선례(재재거릴)
    [InlineData(0x5062)] // 偢 — 愢 선례(인정 없을)
    [InlineData(0x52E1)] // 勡 — 嚇 선례(으를)
    [InlineData(0x5420)] // 吠 — 喧 선례(짖을)
    [InlineData(0x9EE0)] // 黠 — 狡 는 불용이나 '약을'은 약자
    [InlineData(0x76FB)] // 盻 — 瞥 선례(흘겨볼)
    [InlineData(0x8FF7)] // 迷 — 眩 은 불용이나 '미혹할'은 약자
    [InlineData(0x60D1)] // 惑 — 迷 와 같은 훈(미혹할)
    [InlineData(0x91C1)] // 釁 — 祭 근처 '피 칠할'·틈 — 약자
    [InlineData(0x8755)] // 蝕 — 蠹 근처 '좀먹을' — 약자
    [InlineData(0x5AAA)] // 媪 — 媼 선례(할머니 — 媼의 이체)
    [InlineData(0x60D8)] // 惘 — 悶 은 불용이나 '멍할'은 약자
    [InlineData(0x9F6A)] // 齪 — 狹 근처 '악착할'(도량 좁음) — 약자
    [InlineData(0x9F77)] // 齷 — 齪 과 같은 훈(악착할)
    [InlineData(0x5243)] // 剃 — 削 선례(머리털 깎을)
    [InlineData(0x9AF0)] // 髰 — 削 선례(머리털 깎을)
    [InlineData(0x9C3E)] // 鰾 — 鰓 선례(부레)
    [InlineData(0x77F0)] // 矰 — 弩 선례(주살)
    [InlineData(0x8F62)] // 轢 — 踐 선례(짓밟을)
    [InlineData(0x9095)] // 邕 — 壅 과 같은 훈(막을) — 壅 weak 뒤 옹(土·金) 1순위
    [InlineData(0x54A2)] // 咢 — 喧 선례(시끄럽게 다툴)
    [InlineData(0x9157)] // 酗 — 醲 선례(주정할 — 술 훈)
    [InlineData(0x9F38)] // 鼸 — 蛙·蝸 선례(도마뱀 — 범속 동물, 鼠 부수)
    public void NegGloss20261026_IsWeak(int codepoint)
    {
        Assert.True(HanjaData.IsWeakGivenNameHanja(Cp(codepoint)));
        Assert.False(HanjaData.IsForbiddenNameHanja(Cp(codepoint)));
    }

    private static readonly string[] NegGlossCycle = { "木", "火", "土", "金", "水" };

    /// <summary>/evaluate 가 Select 에 넘기는 (용신, 희신 = 용신을 생하는 오행, 기신 = 용신을 극하는 오행) — null 이면 생년월일 없음</summary>
    private static (string? P, string? H, string? G) NegGlossTriple(string? primary)
    {
        if (primary == null) return (null, null, null);
        int i = Array.IndexOf(NegGlossCycle, primary);
        return (primary, NegGlossCycle[(i + 4) % 5], NegGlossCycle[(i + 3) % 5]);
    }

    [Theory]
    [InlineData("항", "male", null, 0x6841, 0x6052)]   // 桁 차꼬 → (1라운드 貥 큰 자개 — Male +40) → 恒 항상 (최항준(남, 생년월일 없음), 보완에서 貥 weak)
    [InlineData("고", "female", null, 0x8831, 0x9AD8)] // 蠱 뱃속벌레 → (暠 밝을 — '밝을' Female 이 2026-10-27 규칙 감사로 Neutral) → 高 높을
    [InlineData("겁", "none", null, 0x5226, 0x8FF2)]   // 刦 겁탈할(劫 이체) → 迲 자래
    [InlineData("짐", "none", null, 0x9D06, 0x659F)]   // 鴆 짐새 → 斟 짐작할
    [InlineData("특", "female", null, 0x5FD2, 0x7279)] // 忒 틀릴 → 特 특별할
    [InlineData("할", "none", "木", 0x778E, 0x8F44)]   // 瞎 애꾸눈 → 轄 다스릴
    [InlineData("폄", "none", "木", 0x7A86, 0x782D)]   // 窆 하관할 → 砭 돌침
    [InlineData("풍", "none", "土", 0x760B, 0x98A8)]   // 瘋 두풍 → 風 바람
    [InlineData("망", "none", "土", 0x9099, 0x8F1E)]   // 邙 북망산 → (1라운드 惘 멍할) → 輞 바퀴 테
    [InlineData("체", "none", "金", 0x91F1, 0x8ADF)]   // 釱 차꼬 → (1라운드 剃 머리털 깎을) → 諟 살필
    [InlineData("독", "none", "水", 0x7006, 0x8B80)]   // 瀆 도랑/더럽힐 → (1라운드 黷 더럽힐) → 讀 읽을
    [InlineData("옹", "none", "土", 0x58C5, 0x96CD)]   // 壅 막을 → (1라운드 邕 막을) → 雍 화할
    [InlineData("표", "none", "水", 0x6B8D, 0x560C)]   // 殍 주려 죽을 → (1라운드 鰾 부레) → 嘌 빠를
    [InlineData("착", "female", "金", 0x7A84, 0x947F)] // 窄 좁을 → (1라운드 齪 악착할) → 鑿 뚫을
    public void NegGloss20261026_SelectPicks(string syllable, string gender, string? yongshin, int reportedCp, int expectedCp)
    {
        var (p, h, g) = NegGlossTriple(yongshin);
        var picked = HanjaSelector.Select(syllable, gender, p, h, g);
        Assert.Single(picked);
        Assert.NotNull(picked[0]);
        Assert.NotEqual(Cp(reportedCp), picked[0]!.Character);
        Assert.Equal(Cp(expectedCp), picked[0]!.Character);
    }

    [Theory]
    [InlineData("안", 0x72B4)] // 犴 들개/감옥
    [InlineData("준", 0x8822)] // 蠢 꿈틀거릴
    [InlineData("한", 0x65F1)] // 旱 가물
    [InlineData("한", 0x6658)] // 晘 가물 (2라운드)
    [InlineData("수", 0x55FD)] // 嗽 기침할 (weak — 뒤로 밀려 상위 10 밖)
    [InlineData("고", 0x5C3B)] // 尻 꽁무니 (weak)
    [InlineData("고", 0x77BD)] // 瞽 맹인 (2라운드)
    [InlineData("곡", 0x688F)] // 梏 수갑
    [InlineData("질", 0x684E)] // 桎 차꼬
    [InlineData("미", 0x8FF7)] // 迷 미혹할 (weak)
    [InlineData("전", 0x6230)] // 戰 싸움
    public void NegGloss20261026_TopForDisplay_ExcludesReported(string syllable, int codepoint)
    {
        var top = HanjaSelector.TopForDisplay(syllable, 10).Select(x => x.Character).ToList();
        Assert.NotEmpty(top);
        Assert.DoesNotContain(Cp(codepoint), top);
    }

    [Fact]
    public void NegGloss20261026_TopForDisplay_WeakGoesBehind()
    {
        // 淪(빠질 륜) — HEAD 에서 륜 후보 2위. weak 는 배제가 아니라 양보라 륜 줄(비약자 8자)에서는 상위 10 끝으로만 밀린다
        var top = HanjaSelector.TopForDisplay("륜", 10).Select(x => x.Character).ToList();
        int i = top.IndexOf(Cp(0x6DEA));
        Assert.True(i < 0 || top.Skip(i).All(HanjaData.IsWeakGivenNameHanja), string.Join("", top));
    }

    [Theory]
    [InlineData("문겸")] // 文慊(찐덥지 않을) → 1차 재생성 때 文鼸(도마뱀) → 文岒
    [InlineData("라겸")] // 羅慊
    [InlineData("세겸")] // 勢慊
    [InlineData("휘겸")] // 輝慊
    [InlineData("어령")] // 圉玲(마부/감옥)
    public void NegGloss20261026_SelectCombos_DropsReported(string name)
    {
        foreach (var g in new[] { "male", "female", "none" })
        {
            var combos = HanjaSelector.SelectCombos(name, g, 4);
            Assert.NotEmpty(combos);
            Assert.All(combos, c =>
            {
                Assert.False(HanjaData.IsForbiddenNameHanja(c.First) || HanjaData.IsForbiddenNameHanja(c.Second), $"{name}/{g}: 불용 {c.First}{c.Second}");
                Assert.False(HanjaData.IsWeakGivenNameHanja(c.First) || HanjaData.IsWeakGivenNameHanja(c.Second), $"{name}/{g}: 약자 {c.First}{c.Second}");
            });
        }
    }

    // ── 같은 날 보완(검증 지적 — 정리 뒤 격자·표시 상위 10 재검수, 2라운드 수렴) ──
    // 근거는 HanjaData.cs 불용 9차 보완·weak 같은 날 보완 블록. 牡 는 불용에서 weak 로 옮겼다(雄 '수컷 웅'이 인명 빈출)

    [Theory]
    [InlineData(0x80C6)] // 胆 신체 부정 — 睾·盲·跛 선례(옷 벗을 단 — 김단우(남) 배정)
    [InlineData(0x81DD)] // 臝 신체 부정 — 같은 선례(벌거벗을)
    [InlineData(0x502E)] // 倮 신체 부정 — 같은 선례(벗을, 부훈 '좁을'은 窄 선례)
    [InlineData(0x88F8)] // 裸 신체 부정 — 臝·倮 와 같은 훈(벗을, 잠재)
    [InlineData(0x4FB5)] // 侵 포악 — 迫·掠·擄 선례(침노할 = 침략)
    [InlineData(0x7669)] // 癩 병 — 瘋·癧 선례(나병, 2라운드 잠재)
    public void NegGloss20261026Fix_IsForbidden(int codepoint)
    {
        Assert.True(HanjaData.IsForbiddenNameHanja(Cp(codepoint)));
        Assert.False(HanjaData.IsWeakGivenNameHanja(Cp(codepoint)));
    }

    [Theory]
    [InlineData(0x5053)] // 偓 — 齷 선례(악착할)
    [InlineData(0x71D2)] // 燒 — 焚·燔·爇 선례(불사를)
    [InlineData(0x721A)] // 爚 — 焚 선례(불사를)
    [InlineData(0x5462)] // 呢 — 呫 선례(소곤거릴)
    [InlineData(0x8076)] // 聶 — 呫 선례(소곤거릴)
    [InlineData(0x54A0)] // 咠 — 呫 선례(소곤거릴)
    [InlineData(0x5665)] // 噥 — 呫 선례(소곤거릴)
    [InlineData(0x6D29)] // 洩 — 泄 선례(샐 — 泄의 이체)
    [InlineData(0x6F0F)] // 漏 — 泄 선례(샐)
    [InlineData(0x6A7D)] // 橽 — 泄 선례(물 샐)
    [InlineData(0x7704)] // 眄 — 盻 선례(곁눈질할)
    [InlineData(0x712E)] // 焮 — 煂 선례(태울)
    [InlineData(0x7147)] // 煇 — 便·降 선례(독음별 훈 — 훈 자리 '태울', 휘 자리 '빛날')
    [InlineData(0x5AD6)] // 嫖 — 瀆 선례(첫 훈 '날랠', 부훈 '음탕할')
    [InlineData(0x8CA5)] // 貥 — 貝 선례(큰 자개 — 사물 훈)
    [InlineData(0x73EC)] // 珬 — 貝 선례(자개)
    [InlineData(0x6ADC)] // 櫜 — 弩·矰 선례(활집 — 무기 사물)
    [InlineData(0x9A5B)] // 驛 — 校 선례(역 — 시설 훈)
    [InlineData(0x7261)] // 牡 — 불용에서 옮김(雄 '수컷 웅'이 인명 빈출)
    [InlineData(0x9265)] // 鉥 — 針 선례(돗바늘, 2라운드)
    [InlineData(0x9DB8)] // 鶸 — 鷄·鴨·鷿 선례(댓닭, 2라운드)
    [InlineData(0x513A)] // 儺 — 祓 선례(푸닥거리, 2라운드)
    [InlineData(0x54EA)] // 哪 — 祓·那 선례(역귀 쫓는 소리/어찌, 2라운드)
    public void NegGloss20261026Fix_IsWeak(int codepoint)
    {
        Assert.True(HanjaData.IsWeakGivenNameHanja(Cp(codepoint)));
        Assert.False(HanjaData.IsForbiddenNameHanja(Cp(codepoint)));
    }

    [Theory]
    [InlineData("단", "male", null, 0x80C6, 0x65E6)] // 胆 옷 벗을 → 旦 아침 (김단우(남, 생년월일 없음))
    [InlineData("단", "male", "水", 0x80C6, 0x6E4D)] // 胆 → 湍 여울
    [InlineData("침", "none", null, 0x4FB5, 0x5BE2)] // 侵 침노할 → 寢 잘
    [InlineData("침", "female", "火", 0x4FB5, 0x99F8)] // 侵 → 駸 달릴
    [InlineData("표", "none", "土", 0x5AD6, 0x719B)] // 嫖 날랠/음탕할 → 熛 불똥
    [InlineData("표", "male", "土", 0x5AD6, 0x5F6A)] // 嫖 → (僄 날랠 — '날랠' Male 이 2026-10-27 규칙 감사로 Neutral) → 彪 범(tiger Male)
    [InlineData("악", "female", "火", 0x5053, 0x9D9A)] // 偓 악착할 → 鶚 물수리
    [InlineData("면", "male", "木", 0x7704, 0x514D)] // 眄 곁눈질할 → 免 면할
    [InlineData("항", "none", "金", 0x8CA5, 0x5AE6)] // 貥 큰 자개 → 嫦 항아
    [InlineData("고", "male", null, 0x6ADC, 0x9AD8)] // 櫜 활집 → 高 높을
    [InlineData("고", "male", "木", 0x6ADC, 0x6832)] // 櫜 → 栲 붉나무
    [InlineData("훈", "female", null, 0x7147, 0x85B0)] // 煇 태울 → 薰 향초 (지훈(여))
    [InlineData("훈", "female", "火", 0x7147, 0x52F3)] // 煇 → 勳 공
    [InlineData("달", "none", "木", 0x6A7D, 0x95E5)] // 橽 물 샐 → 闥 문
    [InlineData("술", "none", "金", 0x73EC, 0x8FF0)] // 珬 자개 → (1라운드 鉥 돗바늘) → 述 펼
    [InlineData("약", "male", "火", 0x721A, 0x7D04)] // 爚 불사를 → (1라운드 鶸 댓닭) → 約 맺을
    [InlineData("약", "female", "火", 0x721A, 0x7D04)] // 爚 → (鶸) → (葯 꽃밥 — 2026-10-27 규칙 감사로 Neutral, 꽃밥은 X꽃 겹낱말이 아님) → 約 맺을
    public void NegGloss20261026Fix_SelectPicks(string syllable, string gender, string? yongshin, int reportedCp, int expectedCp)
        => NegGloss20261026_SelectPicks(syllable, gender, yongshin, reportedCp, expectedCp);

    [Theory]
    [InlineData("표", 0x5AD6)] // 嫖 날랠/음탕할 (weak — 殍·剽·勡 이 빠진 뒤 9위로 들었던 글자)
    [InlineData("단", 0x80C6)] // 胆 옷 벗을
    [InlineData("나", 0x81DD)] // 臝 벌거벗을
    [InlineData("나", 0x502E)] // 倮 벗을
    [InlineData("라", 0x81DD)] // 臝
    [InlineData("라", 0x502E)] // 倮
    [InlineData("나", 0x513A)] // 儺 푸닥거리 (weak, 2라운드)
    [InlineData("침", 0x4FB5)] // 侵 침노할
    [InlineData("소", 0x71D2)] // 燒 불사를 (weak)
    [InlineData("섭", 0x8076)] // 聶 소곤거릴 (weak)
    [InlineData("설", 0x6D29)] // 洩 샐 (weak)
    [InlineData("악", 0x5053)] // 偓 악착할 (weak)
    [InlineData("면", 0x7704)] // 眄 곁눈질할 (weak)
    [InlineData("훈", 0x7147)] // 煇 태울 훈 (weak)
    [InlineData("역", 0x9A5B)] // 驛 역 (weak)
    public void NegGloss20261026Fix_TopForDisplay_ExcludesReported(string syllable, int codepoint)
        => NegGloss20261026_TopForDisplay_ExcludesReported(syllable, codepoint);

    [Theory]
    [InlineData("니", 0x5462)] // 呢 소곤거릴 — 니 줄은 비약자가 3자(馜·濔·柅)뿐이라 상위 10 안에 남되 비약자 뒤
    [InlineData("달", 0x6A7D)] // 橽 물 샐 — 달 줄은 9자뿐
    [InlineData("술", 0x73EC)] // 珬 자개 — 술 줄은 8자뿐
    [InlineData("흔", 0x712E)] // 焮 태울 — 10/26 '남긴 칸' 처리에서 痕 도 weak 가 돼 흔 줄 비약자가 9자라 10위에 남되 비약자 뒤
    public void NegGloss20261026Fix_TopForDisplay_WeakGoesBehind(string syllable, int codepoint)
    {
        var top = HanjaSelector.TopForDisplay(syllable, 10).Select(x => x.Character).ToList();
        int i = top.IndexOf(Cp(codepoint));
        // 상위 10 에 남더라도 그 뒤의 기본 영역 글자는 모두 약자여야 한다(비약자를 앞지르지 않음)
        Assert.True(i < 0 || top.Skip(i).Where(HanjaData.IsInCjkBasicRange).All(HanjaData.IsWeakGivenNameHanja), string.Join("", top));
    }

    [Theory]
    [InlineData("니나")] // 呢羅(소곤거릴) — 3순위
    [InlineData("라니")] // 羅呢 — 3순위
    [InlineData("다니")] // 茶呢 — 4순위
    [InlineData("대니")] // 大呢 — 2순위
    [InlineData("루니")] // 樓呢 — 4순위
    [InlineData("주역")] // 柱驛(역참) — 1차 정리 4순위, 보완 뒤 HEAD 와 같은 周亦
    public void NegGloss20261026Fix_SelectCombos_DropsReported(string name)
        => NegGloss20261026_SelectCombos_DropsReported(name);

    // ── 2026-10-26 '남긴 칸' 처리 — 9차·보완이 '대안 없음'·'부정 훈이 아님'·'잠재'로 남긴 글자(근거는 HanjaData.cs 불용 10차·weak 같은 날 블록) ──
    // 원칙: 명백 부정(형벌·죽음·병·악덕과 그 선례 부류)은 불용 — 그 음절 후보가 0이 되어도 넣는다. 약한 훈은 weak(대안 없으면 남는다).

    [Theory]
    [InlineData(0x5436)] // 吶 말 더듬을 눌 — 啞·聾 선례(언어 장애). 눌 후보 1위였다
    [InlineData(0x8A25)] // 訥 말 더듬거릴 눌 — 같은 훈
    [InlineData(0x5403)] // 吃 말 더듬을 흘 — 같은 훈(9차가 訥 과 함께 둔 글자)
    [InlineData(0x506A)] // 偪 핍박할 핍 — 迫 선례
    [InlineData(0x903C)] // 逼 핍박할 핍 — 迫 선례
    [InlineData(0x9998)] // 馘 귀 벨 괵 — 刖·割·斬 선례
    [InlineData(0x8844)] // 衄 코피 뉵 — 病 선례
    [InlineData(0x6D85)] // 涅 개흙 녈 — 泥·淖·淤 선례
    [InlineData(0x6C92)] // 沒 빠질 몰 — 歿 '죽을 몰'과 통용
    [InlineData(0x85A8)] // 薨 훙서할 훙 — 死·殂 선례
    [InlineData(0x6BA4)] // 殤 일찍 죽을 상 — 잠재
    [InlineData(0x6B80)] // 殀 일찍 죽을 요 — 잠재
    [InlineData(0x592D)] // 夭 일찍 죽을 요 — 첫 훈 기준(잠재)
    [InlineData(0x533F)] // 匿 숨길 닉·사악할 특 — 慝 선례(같은 두 훈)
    [InlineData(0x60C4)] // 惄 허출할 녁 — 飢·餒 선례
    [InlineData(0x610E)] // 愎 강퍅할 퍅 — 很·戾 선례
    [InlineData(0x809B)] // 肛 항문 항 — 尿·膀·胱 선례(9차가 잠재로만 적은 글자)
    [InlineData(0x7B18)] // 笘 회초리 점 — 鞭·箠 선례(2라운드 — 墊 weak 뒤 점 10위)
    public void LeftCells20261026_IsForbidden(int codepoint)
    {
        Assert.True(HanjaData.IsForbiddenNameHanja(Cp(codepoint)));
        Assert.False(HanjaData.IsWeakGivenNameHanja(Cp(codepoint)));
    }

    [Theory]
    [InlineData(0x98EB)] // 飫 물릴 어 — 惓 '싫증날' 선례(어령 2순위 飫玲)
    [InlineData(0x6216)] // 或 혹 혹 — 허사(其·矣·乎 선례)
    [InlineData(0x75D5)] // 痕 흔적 흔 — 瘢 '흉터'는 불용, '흔적'은 약자
    [InlineData(0x9873)] // 顳 관자놀이 섭 — 額·顎·頰 선례
    [InlineData(0x80AD)] // 肭 살찔 눌 — 肥 선례
    [InlineData(0x588A)] // 墊 빠질 점 — 淪 선례
    [InlineData(0x8AF1)] // 諱 숨길 휘 — 秘 선례
    [InlineData(0x6759)] // 杙 말뚝 익 — 臬 선례(2라운드 — 찬익 4순위 燦杙)
    [InlineData(0x5F0B)] // 弋 주살 익 — 矰 선례(2라운드)
    [InlineData(0x8089)] // 肉 고기 육 — 膚·肥·乳 선례(재생성 두더지 — 육 후보 1위·배정 9칸, 育 과 관련도 동점)
    public void LeftCells20261026_IsWeak(int codepoint)
    {
        Assert.True(HanjaData.IsWeakGivenNameHanja(Cp(codepoint)));
        Assert.False(HanjaData.IsForbiddenNameHanja(Cp(codepoint)));
    }

    /// <summary>판단만 하고 세트에 넣지 않은 글자 — 근거는 HanjaData.cs 불용 10차 블록 위 CLAUDE.md '남긴 칸 처리' 줄</summary>
    [Theory]
    [InlineData(0x55DB)] // 嗛 겸손할 겸 — 첫 훈 기준①(부훈 '흉년 들'·'원한 품을 함'은 歉·銜 통가), 라겸·문겸 2순위 등 12명
    [InlineData(0x95E5)] // 闥 문 달 — 門 '문 문' 비약자 선례, 달(木) 1순위
    [InlineData(0x9EDA)] // 黚 검누를 겸 — 색 이름 단독은 약자 아님(黔·黝·緇·玄 비약자) — 라겸·문겸 조합 뜻 문장만 훈에 맞게 고침
    public void LeftCells20261026_KeptAsIs(int codepoint)
    {
        Assert.False(HanjaData.IsForbiddenNameHanja(Cp(codepoint)));
        Assert.False(HanjaData.IsWeakGivenNameHanja(Cp(codepoint)));
    }

    private static readonly string?[] LeftCellsYongshin = { null, "木", "火", "土", "金", "水" };

    /// <summary>
    /// 글자가 모두 불용인 음절 — 배정 없음(null)·표시 후보 0개·안내 문구. 옛 후보 0 음절(에·죄·틈·픽·혐·히)과 같은 경로이고,
    /// 뜻 없는 글자만 남은 핍(畐)·뉵(沑)도 그 글자로 메우지 않는다(Select 가 뜻 있는 글자가 모두 불용이면 null).
    /// </summary>
    [Theory]
    [InlineData("괵")] // 馘
    [InlineData("녈")] // 涅
    [InlineData("몰")] // 沒(歿 은 기존 불용)
    [InlineData("닉")] // 匿(溺 은 6차 불용)
    [InlineData("녁")] // 惄
    [InlineData("훙")] // 薨
    [InlineData("퍅")] // 愎
    [InlineData("핍")] // 偪·逼(乏 은 기존 불용) — 뜻 없는 畐 만 남음
    [InlineData("뉵")] // 衄 — 뜻 없는 沑 만 남음
    [InlineData("에")] // 曀·恚 — 옛 후보 0 음절
    [InlineData("죄")] // 罪
    [InlineData("혐")] // 嫌
    public void LeftCells20261026_NoUsableHanja_NoAssignment(string syllable)
    {
        Assert.NotEmpty(HanjaData.FindByReading(syllable)); // 사전 독음은 있다 — 순우리말 음절과 다른 안내
        Assert.Empty(HanjaSelector.TopForDisplay(syllable, 10));
        foreach (var g in new[] { "none", "male", "female" })
            foreach (var y in LeftCellsYongshin)
            {
                var (p, h, gi) = NegGlossTriple(y);
                var picked = HanjaSelector.Select(syllable, g, p, h, gi);
                Assert.Single(picked);
                Assert.Null(picked[0]);
            }
        Assert.Equal(HanjaSelector.NoUsableHanjaNote, HanjaSelector.NoHanjaNoteFor(syllable));
    }

    [Theory]
    [InlineData("봄")]
    [InlineData("빛")]
    [InlineData("꽃")]
    public void LeftCells20261026_PureKoreanSyllable_ReadingNote(string syllable)
    {
        Assert.Empty(HanjaData.FindByReading(syllable));
        Assert.Null(HanjaSelector.Select(syllable, "none", null, null, null)[0]);
        Assert.Equal(HanjaSelector.NoHanjaReadingNote, HanjaSelector.NoHanjaNoteFor(syllable));
    }

    [Theory]
    [InlineData("민")]
    [InlineData("눌")] // 吶·訥 불용 뒤 肭(살찔 — weak) 하나 — 대안 없는 약자라 배정·표시는 남는다(녀=女 와 같은 경로)
    [InlineData("혹")] // 或 weak 뒤 熇(뜨거울)
    public void LeftCells20261026_UsableSyllable_NoNote(string syllable)
    {
        Assert.NotEmpty(HanjaSelector.TopForDisplay(syllable, 10));
        Assert.Null(HanjaSelector.NoHanjaNoteFor(syllable));
    }

    [Theory]
    [InlineData("어", "none", "水", 0x98EB, 0x5539)]   // 飫 물릴 → 唹 고요히 웃을
    [InlineData("혹", "male", null, 0x6216, 0x7187)]   // 或 혹(허사) → 熇 뜨거울
    [InlineData("흔", "none", "水", 0x75D5, 0x6615)]   // 痕 흔적 → 昕 새벽
    [InlineData("점", "female", "土", 0x588A, 0x576B)] // 墊 빠질 → 坫 토대(옛 '산 이름' 岾 — 坫 은 옛 Male(영문 'king'⊂'drinking' 부분 일치)이라 여자에게 밀렸고
                                                       // 2026-10-27 규칙 감사로 Neutral, 土 용신 일치)
    [InlineData("익", "none", "木", 0x6759, 0x76CA)]   // 杙 말뚝 → 益 더할 (HEAD 부터의 칸)
    [InlineData("익", "none", "金", 0x5F0B, 0x8B1A)]   // 弋 주살 → 謚 웃을
    [InlineData("눌", "none", null, 0x5436, 0x80AD)]   // 吶 말 더듬을 → 肭 살찔(weak — 유일)
    [InlineData("눌", "male", "金", 0x8A25, 0x80AD)]   // 訥 말 더듬거릴 → 肭
    [InlineData("육", "none", null, 0x8089, 0x80B2)]   // 肉 고기 → 育 기를 (재생성 두더지)
    [InlineData("육", "female", "水", 0x8089, 0x80B2)]
    public void LeftCells20261026_SelectPicks(string syllable, string gender, string? yongshin, int reportedCp, int expectedCp)
        => NegGloss20261026_SelectPicks(syllable, gender, yongshin, reportedCp, expectedCp);

    [Theory]
    [InlineData("어령", 0x98EB)] // 飫玲 2순위(11/08 공개)
    [InlineData("찬익", 0x6759)] // 燦杙 — 1라운드 재생성 4순위(匿 불용으로 익 줄 상위 6이 바뀐 뒤)
    public void LeftCells20261026_SelectCombos_DropsReported(string name, int codepoint)
    {
        foreach (var g in new[] { "male", "female", "none" })
        {
            var combos = HanjaSelector.SelectCombos(name, g, 4);
            Assert.NotEmpty(combos);
            Assert.DoesNotContain(combos, c => c.First == Cp(codepoint) || c.Second == Cp(codepoint));
        }
    }

    /// <summary>
    /// SelectCombos 는 확장 영역 글자가 든 쌍을 빈칸 채우기로 쓰지 않는다 — 사이트 한자 폰트(Noto Serif KR 조각)에 확장 A·B 가 없다.
    /// 옛 결과 50쌍(새=㘔·니=㦐·슬=㻭·𩇣·솔=䢦·𧗿·별=䭱·울=𠃗·별=㔡)이 있던 이름들. 조합이 4개보다 적어도 된다(새라 → 璽羅 하나).
    /// </summary>
    [Theory]
    [InlineData("니나")] [InlineData("라니")] [InlineData("나슬")] [InlineData("라별")] [InlineData("라솔")] [InlineData("라울")]
    [InlineData("새나")] [InlineData("새라")] [InlineData("새론")] [InlineData("새벽")] [InlineData("새별")] [InlineData("새솔")]
    [InlineData("솔빈")] [InlineData("슬빈")] [InlineData("슬찬")] [InlineData("은새")] [InlineData("찬별")] [InlineData("찬울")] [InlineData("한새")]
    public void ExtensionArea20261026_SelectCombos_BasicOnly(string name)
    {
        foreach (var g in new[] { "male", "female", "none" })
        {
            var combos = HanjaSelector.SelectCombos(name, g, 4);
            Assert.NotEmpty(combos);
            Assert.True(combos.Count <= 4);
            Assert.All(combos, c => Assert.True(HanjaData.IsInCjkBasicRange(c.First) && HanjaData.IsInCjkBasicRange(c.Second),
                $"{name}/{g}: 확장 영역 {c.First}{c.Second} (U+{char.ConvertToUtf32(c.First, 0):X4} U+{char.ConvertToUtf32(c.Second, 0):X4})"));
        }
    }

    [Fact]
    public void ExtensionArea20261026_SelectCombos_KeepsWhenOnlyExtensionIsNonWeak()
    {
        // 글 줄은 契(부족 이름 — weak)·㔕(뜻 — 확장 A) 둘뿐이라 약자 양보가 먼저(Select 와 같은 순서) — 확장 쌍이 그대로 남아 조합이 사라지지 않는다
        var combos = HanjaSelector.SelectCombos("한글", "none", 4);
        Assert.NotEmpty(combos);
        Assert.All(combos, c => Assert.Equal(Cp(0x3515), c.Second));
    }

    [Fact]
    public void ExtensionArea20261026_SelectCombos_MayReturnFewerThanK()
    {
        // 새 줄 기본 영역 비약자는 璽 하나 — 옛 4칸 채우기의 㘔羅 가 빠져 새라는 한 쌍
        var combos = HanjaSelector.SelectCombos("새라", "female", 4);
        Assert.Single(combos);
        Assert.Equal((Cp(0x74BD), Cp(0x7F85)), combos[0]);
    }

    /// <summary>
    /// 2026-10-27 성별 표 전면 적용(고친 genderPref·선택기 O3) 재생성 두더지 4라운드 — 반대 성별 글자를 뺀 칸·Male/Female 이 Neutral 이 된 줄에
    /// 새로 오른 글자. 근거는 HanjaData.cs weak 2026-10-27 블록·불용 11차 주석.
    /// </summary>
    [Theory]
    [InlineData(0x7E15)] // 縕 헌솜 온 — 나온·새온 2순위
    [InlineData(0x6A75)] // 橵 산자 산 — 산아·산휘 1순위
    [InlineData(0x6AD3)] // 櫓 방패 로 — 로빈·로휘 4순위
    [InlineData(0x8880)] // 袀 군복 균 — 찬균 4순위
    [InlineData(0x78C1)] // 磁 자석 자 — 자헌 3순위
    [InlineData(0x7C05)] // 簅 큰 피리 산 — 산해 3순위
    [InlineData(0x76E4)] // 盤 소반 반 — 반희 1순위 盤喜
    [InlineData(0x5830)] // 堰 둑 언 — 준언 4순위
    [InlineData(0x58DA)] // 壚 검은 석비레 로 — 마로 4순위
    [InlineData(0x6E26)] // 渦 소용돌이 와
    [InlineData(0x6D3C)] // 洼 웅덩이 와
    [InlineData(0x5261)] // 剡 땅 이름 섬
    [InlineData(0x5581)] // 喁 벌름거릴 옹
    [InlineData(0x7752)] // 睒 언뜻 볼 섬
    [InlineData(0x647B)] // 摻 가늘 섬
    [InlineData(0x5131)] // 儱 미숙한 모양 롱 — 초롱 1순위
    [InlineData(0x63A7)] // 控 당길 공 — 공명 1순위
    [InlineData(0x5F85)] // 待 기다릴 대 — 대권·대산 1순위
    [InlineData(0x5DE1)] // 巡 돌 순 — 순옥 1순위
    [InlineData(0x5FAA)] // 循 돌 순 — 巡 과 같은 훈
    [InlineData(0x5167)] // 內 안 내 — 시내 3·4순위
    [InlineData(0x72FB)] // 狻 사자 산 — 강산 4순위
    [InlineData(0x4E08)] // 丈 어른 장 — 장민·장수·장군·장연 1순위
    [InlineData(0x708E)] // 炎 담 자리 아름다울 — 담휘·아담 4순위
    [InlineData(0x70D8)] // 烘 화톳불 홍 — 홍 줄 15→39쌍
    [InlineData(0x66C5)] // 曅 曄 의 이체 — 찬엽 4순위
    [InlineData(0x5B7F)] // 孿 쌍둥이 산 — 2라운드
    [InlineData(0x7522)] // 產 낳을 산 — 2라운드
    [InlineData(0x7523)] // 産 낳을 산 — 產 과 같은 훈(産 은 HEAD 전부터 weak — 자형 짝 확인용)
    [InlineData(0x5098)] // 傘 우산 산 — 2라운드
    [InlineData(0x64E1)] // 擡 들 대 — 2라운드
    [InlineData(0x5ABB)] // 媻 비틀거릴 반 — 2라운드
    [InlineData(0x9583)] // 閃 엿볼 섬 — 2라운드
    [InlineData(0x965D)] // 陝 땅 이름 섬 — 2라운드
    [InlineData(0x5B45)] // 孅 가늘 섬 — 2라운드
    [InlineData(0x7A8A)] // 窊 우묵할 와 — 2라운드
    [InlineData(0x9954)] // 饔 아침밥 옹 — 2라운드
    [InlineData(0x65EC)] // 旬 열흘 순 — 2라운드
    [InlineData(0x6C55)] // 汕 오구 산 — 3라운드
    [InlineData(0x7958)] // 祘 산가지 산 — 3라운드
    [InlineData(0x7E56)] // 繖 우산 산 — 3라운드
    [InlineData(0x849C)] // 蒜 마늘 산 — 3라운드
    [InlineData(0x9730)] // 霰 싸라기눈 산 — 3라운드(잠재)
    [InlineData(0x7AAA)] // 窪 웅덩이 와 — 3라운드
    [InlineData(0x7AC7)] // 竇 구멍 두 — 4라운드
    [InlineData(0x591B)] // 夛 多 의 이체 — 다형 4순위 夛炯(多炯 과 같은 페이지), 曅 선례
    public void MoleAudit20261027_IsWeak(int codepoint)
    {
        Assert.True(HanjaData.IsWeakGivenNameHanja(Cp(codepoint)));
        Assert.False(HanjaData.IsForbiddenNameHanja(Cp(codepoint)));
    }

    [Fact]
    public void MoleAudit20261027_Shan_IsForbidden()
    {
        // 疝 산증 산 — 疥·癨 선례(병 훈). 산 줄 weak 를 넓히며 다음 순번에 다가선 잠재 글자(불용 11차)
        Assert.True(HanjaData.IsForbiddenNameHanja(Cp(0x759D)));
    }

    [Theory]
    [InlineData("반희", 0x76E4)] // 盤
    [InlineData("공명", 0x63A7)] // 控
    [InlineData("초롱", 0x5131)] // 儱
    [InlineData("장민", 0x4E08)] // 丈
    [InlineData("장수", 0x4E08)] // 丈
    [InlineData("대권", 0x5F85)] // 待
    [InlineData("순옥", 0x5DE1)] // 巡
    [InlineData("강산", 0x5B7F)] // 孿
    [InlineData("산아", 0x6A75)] // 橵
    [InlineData("마로", 0x58DA)] // 壚
    [InlineData("슬옹", 0x5581)] // 喁
    [InlineData("두산", 0x7AC7)] // 竇
    [InlineData("다형", 0x591B)] // 夛 — 多炯 과 夛炯 이 한 페이지에(多 이체)
    [InlineData("다휘", 0x591B)] // 夛 — HEAD 부터 多輝 옆 4순위
    public void MoleAudit20261027_SelectCombos_DropsReported(string name, int codepoint)
    {
        foreach (var g in new[] { "male", "female", "none" })
        {
            var combos = HanjaSelector.SelectCombos(name, g, 4);
            Assert.NotEmpty(combos);
            Assert.DoesNotContain(combos, c => c.First == Cp(codepoint) || c.Second == Cp(codepoint));
        }
    }

    [Theory]
    [InlineData("산아")]
    [InlineData("산휘")]
    public void MoleAudit20261027_SanLine_FewerCombosNotWeakFill(string name)
    {
        // 산 줄 비약자는 山·珊 뿐 — 약자(孿·產·傘·祘 …)로 산 자리를 채우지 않는다(O3 보완 ② — /name 산아·산휘는 조합 1개)
        foreach (var g in new[] { "male", "female", "none" })
        {
            var combos = HanjaSelector.SelectCombos(name, g, 4);
            Assert.NotEmpty(combos);
            Assert.All(combos, c => Assert.Contains(c.First, new[] { Cp(0x5C71), Cp(0x73CA) }));
        }
    }
}
