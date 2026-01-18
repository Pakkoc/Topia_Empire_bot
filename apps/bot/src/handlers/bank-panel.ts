import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  type ButtonInteraction,
  type APIContainerComponent,
  MessageFlags,
  type Client,
} from 'discord.js';
import type {
  CurrencyService,
  BankService,
  VaultService,
  TreasuryService,
} from '@topia/core';

// Components v2 플래그 (1 << 15)
const IS_COMPONENTS_V2 = 32768;

interface Container {
  currencyService: CurrencyService;
  bankService: BankService;
  vaultService: VaultService;
  treasuryService: TreasuryService;
}

/** 은행 패널 메인 컨테이너 생성 */
export function createBankPanelContainer(
  bankName: string,
  topyBalance: bigint,
  rubyBalance: bigint,
  topyName: string,
  rubyName: string
): APIContainerComponent {
  const container = new ContainerBuilder()
    .setAccentColor(0x2ecc71)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# 🏦 ${bankName}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**📊 국고 현황**\n` +
        `   • ${topyName}: **${topyBalance.toLocaleString()}**\n` +
        `   • ${rubyName}: **${rubyBalance.toLocaleString()}**`
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**💳 구독 혜택 안내**\n` +
        `   • **Silver**: 이체수수료 면제, 금고 10만, 월 1% 이자\n` +
        `   • **Gold**: 구매수수료 면제, 금고 20만, 월 2% 이자`
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# 아래 버튼을 눌러 내 정보를 확인하거나 금고를 이용하세요.`
      )
    );

  return container.toJSON();
}

/** 은행 패널 버튼 행 생성 */
export function createBankPanelButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('bank_panel_my_info')
      .setLabel('📋 내 정보')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('bank_panel_deposit')
      .setLabel('📥 예금')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('bank_panel_withdraw')
      .setLabel('📤 출금')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('bank_panel_history')
      .setLabel('📜 내역')
      .setStyle(ButtonStyle.Secondary)
  );
}

/** 내 정보 버튼 핸들러 */
export async function handleMyInfoButton(
  interaction: ButtonInteraction,
  container: Container
): Promise<void> {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!guildId) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있습니다.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // 화폐 설정 조회
  const settingsResult = await container.currencyService.getSettings(guildId);
  const settings = settingsResult.success ? settingsResult.data : null;
  const topyName = settings?.topyName || '토피';
  const rubyName = settings?.rubyName || '루비';
  const bankName = settings?.bankName || '디토뱅크';

  // 구독 정보 조회
  const subscriptionResult = await container.bankService.getActiveSubscription(guildId, userId);
  const subscription = subscriptionResult.success ? subscriptionResult.data : null;

  // 금고 정보 조회
  const vaultResult = await container.vaultService.getVaultSummary(guildId, userId);
  const vault = vaultResult.success ? vaultResult.data : null;

  // 혜택 정보 조회
  const benefitsResult = await container.bankService.getUserBenefits(guildId, userId);
  const benefits = benefitsResult.success ? benefitsResult.data : null;

  let subscriptionText = '**💳 구독**: 없음';
  if (subscription) {
    const tierName = subscription.tier === 'gold' ? 'Gold' : 'Silver';
    const expiresAt = subscription.expiresAt.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    subscriptionText = `**💳 구독**: ${tierName} (${expiresAt} 만료)`;

    if (benefits) {
      const benefitsList: string[] = [];
      if (benefits.transferFeeExempt) benefitsList.push('이체수수료 면제');
      if (benefits.purchaseFeePercent === 0) benefitsList.push('구매수수료 면제');
      if (benefits.interestRate > 0) benefitsList.push(`월 ${benefits.interestRate}% 이자`);

      if (benefitsList.length > 0) {
        subscriptionText += `\n   • ${benefitsList.join('\n   • ')}`;
      }
    }
  }

  let vaultText = '**🏦 금고**: 미개설';
  if (vault && vault.vault) {
    const limit = vault.storageLimit;
    const deposited = vault.vault.depositedAmount;
    vaultText = `**🏦 금고**\n` +
      `   • 잔액: **${deposited.toLocaleString()}** / ${limit.toLocaleString()} ${topyName}`;

    if (vault.interestRate > 0) {
      const expectedInterest = (deposited * BigInt(vault.interestRate)) / BigInt(100);
      vaultText += `\n   • 이번 달 예상 이자: +${expectedInterest.toLocaleString()} ${topyName}`;
    }
  }

  const infoContainer = new ContainerBuilder()
    .setAccentColor(0x3498db)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# 👤 내 ${bankName} 정보`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(subscriptionText)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(vaultText)
    );

  await interaction.editReply({
    components: [infoContainer.toJSON()],
    flags: IS_COMPONENTS_V2,
  });
}

/** 예금 버튼 핸들러 */
export async function handleDepositButton(
  interaction: ButtonInteraction,
  container: Container
): Promise<void> {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!guildId) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있습니다.',
      ephemeral: true,
    });
    return;
  }

  // /금고 예금 명령어 안내
  const infoContainer = new ContainerBuilder()
    .setAccentColor(0x3498db)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# 📥 예금 안내')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '금고에 예금하려면 `/금고 예금` 명령어를 사용하세요.\n\n' +
        '**사용법**\n' +
        '`/금고 예금 금액:1000`\n\n' +
        '-# 금고 한도는 구독 티어에 따라 다릅니다.'
      )
    );

  await interaction.reply({
    components: [infoContainer.toJSON()],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

/** 출금 버튼 핸들러 */
export async function handleWithdrawButton(
  interaction: ButtonInteraction,
  container: Container
): Promise<void> {
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있습니다.',
      ephemeral: true,
    });
    return;
  }

  // /금고 출금 명령어 안내
  const infoContainer = new ContainerBuilder()
    .setAccentColor(0x3498db)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# 📤 출금 안내')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '금고에서 출금하려면 `/금고 출금` 명령어를 사용하세요.\n\n' +
        '**사용법**\n' +
        '`/금고 출금 금액:1000`\n\n' +
        '-# 출금 시 수수료가 발생하지 않습니다.'
      )
    );

  await interaction.reply({
    components: [infoContainer.toJSON()],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

/** 내역 버튼 핸들러 - 개인 거래 내역 */
export async function handleHistoryButton(
  interaction: ButtonInteraction,
  container: Container
): Promise<void> {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!guildId) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있습니다.',
      ephemeral: true,
    });
    return;
  }

  // /내정보 명령어 안내
  const infoContainer = new ContainerBuilder()
    .setAccentColor(0x3498db)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# 📜 거래 내역 안내')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '개인 거래 내역은 웹 대시보드에서 확인할 수 있습니다.\n\n' +
        '**국고 거래 내역**\n' +
        '관리자는 `/국고 내역` 명령어로 국고 거래 내역을 확인할 수 있습니다.'
      )
    );

  await interaction.reply({
    components: [infoContainer.toJSON()],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}

/** 은행 패널 버튼 상호작용 핸들러 */
export async function handleBankPanelInteraction(
  interaction: ButtonInteraction,
  container: Container
): Promise<boolean> {
  const customId = interaction.customId;

  if (!customId.startsWith('bank_panel_')) {
    return false;
  }

  switch (customId) {
    case 'bank_panel_my_info':
      await handleMyInfoButton(interaction, container);
      return true;
    case 'bank_panel_deposit':
      await handleDepositButton(interaction, container);
      return true;
    case 'bank_panel_withdraw':
      await handleWithdrawButton(interaction, container);
      return true;
    case 'bank_panel_history':
      await handleHistoryButton(interaction, container);
      return true;
    default:
      return false;
  }
}

/** 은행 패널 새로고침 (국고 잔액 업데이트) */
export async function refreshBankPanel(
  client: Client,
  guildId: string,
  container: Container
): Promise<void> {
  try {
    const settingsResult = await container.currencyService.getSettings(guildId);
    const settings = settingsResult.success ? settingsResult.data : null;

    if (!settings?.bankPanelChannelId || !settings?.bankPanelMessageId) {
      return; // 패널이 설치되어 있지 않음
    }

    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(settings.bankPanelChannelId);

    if (!channel || !('messages' in channel)) {
      return;
    }

    const message = await channel.messages.fetch(settings.bankPanelMessageId).catch(() => null);
    if (!message) {
      return;
    }

    // 최신 국고 잔액 조회
    const topyName = settings.topyName || '토피';
    const rubyName = settings.rubyName || '루비';
    const bankName = settings.bankName || '디토뱅크';

    const treasuryResult = await container.treasuryService.getTreasury(guildId);
    const topyBalance = treasuryResult.success ? treasuryResult.data.topyBalance : BigInt(0);
    const rubyBalance = treasuryResult.success ? treasuryResult.data.rubyBalance : BigInt(0);

    const panelContainer = createBankPanelContainer(bankName, topyBalance, rubyBalance, topyName, rubyName);
    const buttonRow = createBankPanelButtons();

    await message.edit({
      components: [panelContainer, buttonRow],
      flags: MessageFlags.IsComponentsV2,
    });

    console.log(`[BANK] Panel refreshed in guild ${guildId}`);
  } catch (error) {
    console.error('[BANK] Failed to refresh panel:', error);
  }
}
