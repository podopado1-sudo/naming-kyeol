namespace NameForm.Tests;

/// <summary>
/// 공유 사전(<c>HanjaData</c> 의 static 사전)의 글자 항목을 잠깐 고치는 테스트와, 사전 전체를 디스크의 산출물과 대조하는 테스트를 한 묶음에 둔다.
/// xUnit 은 같은 묶음의 클래스를 동시에 돌리지 않으므로, 고치는 테스트가 값을 바꿔 둔 사이에 대조 테스트가 그 값을 읽는 일이 없다.
/// 고치는 테스트는 끝에 원래 값을 되돌린다(되돌리지 않으면 같은 실행의 뒤 테스트가 운영과 다른 사전을 본다 —
/// 2026-11 정적 후보 파일 대조가 水 의 뜻 '물 수' → '물' 로 잡아냈다).
/// 사전 항목을 고치는 테스트를 새로 쓰면 이 묶음에 넣고 되돌릴 것.
/// </summary>
[CollectionDefinition(Name)]
public sealed class HanjaDictionaryMutationCollection
{
    public const string Name = "HanjaData 사전 항목을 고치는 테스트";
}
