import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
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

  // 금고 정보 조회 (구독 확인)
  const summaryResult = await container.vaultService.getVaultSummary(guildId, userId);
  if (!summaryResult.success || summaryResult.data.storageLimit === BigInt(0)) {
    const noSubContainer = new ContainerBuilder()
      .setAccentColor(0xff6b6b)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# ❌ 금고 이용 불가')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          '금고는 디토뱅크 구독자만 이용할 수 있습니다.\n\n' +
          '상점에서 **디토 실버** 또는 **디토 골드** 구독권을 구매하세요.'
        )
      );

    await interaction.reply({
      components: [noSubContainer.toJSON()],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  const { vault, storageLimit } = summaryResult.data;
  const currentDeposit = vault?.depositedAmount ?? BigInt(0);
  const remainingLimit = storageLimit - currentDeposit;

  // 모달 생성
  const modal = new ModalBuilder()
    .setCustomId('bank_panel_deposit_modal')
    .setTitle('금고 예금');

  const amountInput = new TextInputBuilder()
    .setCustomId('deposit_amount')
    .setLabel(`예금할 금액 (남은 한도: ${remainingLimit.toLocaleString()})`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: 10000')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(15);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput);
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

/** 출금 버튼 핸들러 */
export async function handleWithdrawButton(
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

  // 금고 정보 조회
  const summaryResult = await container.vaultService.getVaultSummary(guildId, userId);
  const vault = summaryResult.success ? summaryResult.data.vault : null;
  const currentDeposit = vault?.depositedAmount ?? BigInt(0);

  if (currentDeposit === BigInt(0)) {
    const emptyContainer = new ContainerBuilder()
      .setAccentColor(0xff6b6b)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# ❌ 출금 불가')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('금고에 예치된 금액이 없습니다.')
      );

    await interaction.reply({
      components: [emptyContainer.toJSON()],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  // 모달 생성
  const modal = new ModalBuilder()
    .setCustomId('bank_panel_withdraw_modal')
    .setTitle('금고 출금');

  const amountInput = new TextInputBuilder()
    .setCustomId('withdraw_amount')
    .setLabel(`출금할 금액 (금고 잔액: ${currentDeposit.toLocaleString()})`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: 10000')
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(15);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput);
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
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

  await interaction.deferReply({ ephemeral: true });

  // 화폐 설정 조회
  const settingsResult = await container.currencyService.getSettings(guildId);
  const topyName = settingsResult.success && settingsResult.data ? settingsResult.data.topyName : '토피';
  const rubyName = settingsResult.success && settingsResult.data ? settingsResult.data.rubyName : '루비';

  // 최근 거래 내역 조회 (최근 10건)
  const transactionsResult = await container.currencyService.getTransactions(guildId, {
    userId,
    limit: 10,
  });

  if (!transactionsResult.success || transactionsResult.data.length === 0) {
    const emptyContainer = new ContainerBuilder()
      .setAccentColor(0x3498db)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# 📜 거래 내역')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('최근 거래 내역이 없습니다.')
      );

    await interaction.editReply({
      components: [emptyContainer.toJSON()],
      flags: IS_COMPONENTS_V2,
    });
    return;
  }

  const transactions = transactionsResult.data;

  // 거래 타입별 이모지 및 라벨
  const typeLabels: Record<string, { emoji: string; label: string }> = {
    grant: { emoji: '➕', label: '지급' },
    deduct: { emoji: '➖', label: '차감' },
    transfer_in: { emoji: '📥', label: '받음' },
    transfer_out: { emoji: '📤', label: '보냄' },
    shop_purchase: { emoji: '🛒', label: '구매' },
    fee: { emoji: '💸', label: '수수료' },
    tax: { emoji: '🏛️', label: '세금' },
    vault_deposit: { emoji: '🏦', label: '예금' },
    vault_withdraw: { emoji: '🏦', label: '출금' },
    attendance: { emoji: '📅', label: '출석' },
    text_earn: { emoji: '💬', label: '채팅' },
    voice_earn: { emoji: '🎤', label: '음성' },
  };

  // 거래 내역 텍스트 생성
  let historyText = '';
  for (const tx of transactions) {
    const typeInfo = typeLabels[tx.transactionType] || { emoji: '•', label: tx.transactionType };
    const currencyEmoji = tx.currencyType === 'topy' ? '💰' : '💎';
    const currencyLabel = tx.currencyType === 'topy' ? topyName : rubyName;
    const amountStr = tx.amount >= 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString();
    const date = new Date(tx.createdAt);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

    historyText += `${typeInfo.emoji} **${typeInfo.label}** ${currencyEmoji} ${amountStr} ${currencyLabel} \`${dateStr}\`\n`;
  }

  const historyContainer = new ContainerBuilder()
    .setAccentColor(0x3498db)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# 📜 최근 거래 내역')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(historyText.trim())
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('-# 최근 10건의 거래 내역입니다.')
    );

  await interaction.editReply({
    components: [historyContainer.toJSON()],
    flags: IS_COMPONENTS_V2,
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

/** 예금 모달 제출 핸들러 */
async function handleDepositModalSubmit(
  interaction: ModalSubmitInteraction,
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

  // 입력값 파싱
  const amountStr = interaction.fields.getTextInputValue('deposit_amount').replace(/,/g, '').trim();
  const amount = BigInt(amountStr || '0');

  if (amount <= BigInt(0)) {
    const errorContainer = new ContainerBuilder()
      .setAccentColor(0xff6b6b)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# ❌ 예금 실패')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('예금 금액은 0보다 커야 합니다.')
      );

    await interaction.editReply({
      components: [errorContainer.toJSON()],
      flags: IS_COMPONENTS_V2,
    });
    return;
  }

  // 화폐 설정 조회
  const settingsResult = await container.currencyService.getSettings(guildId);
  const topyName = settingsResult.success && settingsResult.data ? settingsResult.data.topyName : '토피';

  // 예금 실행
  const depositResult = await container.vaultService.deposit(guildId, userId, amount);

  if (!depositResult.success) {
    let errorMessage = '예금 처리 중 오류가 발생했습니다.';
    const errorType = depositResult.error.type;

    if (errorType === 'INSUFFICIENT_BALANCE') {
      errorMessage = `지갑에 ${topyName}가 부족합니다.`;
    } else if (errorType === 'VAULT_LIMIT_EXCEEDED') {
      errorMessage = '금고 한도를 초과합니다. 더 적은 금액을 예금하거나 구독을 업그레이드하세요.';
    } else if (errorType === 'NO_SUBSCRIPTION') {
      errorMessage = '금고가 개설되어 있지 않습니다. 구독권을 먼저 구매하세요.';
    }

    const errorContainer = new ContainerBuilder()
      .setAccentColor(0xff6b6b)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# ❌ 예금 실패')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(errorMessage)
      );

    await interaction.editReply({
      components: [errorContainer.toJSON()],
      flags: IS_COMPONENTS_V2,
    });
    return;
  }

  const result = depositResult.data;

  // 지갑 잔액 조회
  const walletResult = await container.currencyService.getWallet(guildId, userId);
  const walletBalance = walletResult.success && walletResult.data ? walletResult.data.balance : BigInt(0);

  const successContainer = new ContainerBuilder()
    .setAccentColor(0x2ecc71)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# ✅ 예금 완료')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**📥 예금액**: ${amount.toLocaleString()} ${topyName}\n` +
        `**🏦 금고 잔액**: ${result.newTotal.toLocaleString()} ${topyName}\n` +
        `**💰 지갑 잔액**: ${walletBalance.toLocaleString()} ${topyName}`
      )
    );

  await interaction.editReply({
    components: [successContainer.toJSON()],
    flags: IS_COMPONENTS_V2,
  });
}

/** 출금 모달 제출 핸들러 */
async function handleWithdrawModalSubmit(
  interaction: ModalSubmitInteraction,
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

  // 입력값 파싱
  const amountStr = interaction.fields.getTextInputValue('withdraw_amount').replace(/,/g, '').trim();
  const amount = BigInt(amountStr || '0');

  if (amount <= BigInt(0)) {
    const errorContainer = new ContainerBuilder()
      .setAccentColor(0xff6b6b)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# ❌ 출금 실패')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('출금 금액은 0보다 커야 합니다.')
      );

    await interaction.editReply({
      components: [errorContainer.toJSON()],
      flags: IS_COMPONENTS_V2,
    });
    return;
  }

  // 화폐 설정 조회
  const settingsResult = await container.currencyService.getSettings(guildId);
  const topyName = settingsResult.success && settingsResult.data ? settingsResult.data.topyName : '토피';

  // 출금 실행
  const withdrawResult = await container.vaultService.withdraw(guildId, userId, amount);

  if (!withdrawResult.success) {
    let errorMessage = '출금 처리 중 오류가 발생했습니다.';
    const errorType = withdrawResult.error.type;

    if (errorType === 'INSUFFICIENT_VAULT_BALANCE') {
      errorMessage = '금고에 잔액이 부족합니다.';
    }

    const errorContainer = new ContainerBuilder()
      .setAccentColor(0xff6b6b)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# ❌ 출금 실패')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(errorMessage)
      );

    await interaction.editReply({
      components: [errorContainer.toJSON()],
      flags: IS_COMPONENTS_V2,
    });
    return;
  }

  const result = withdrawResult.data;

  // 지갑 잔액 조회
  const walletResult = await container.currencyService.getWallet(guildId, userId);
  const walletBalance = walletResult.success && walletResult.data ? walletResult.data.balance : BigInt(0);

  const successContainer = new ContainerBuilder()
    .setAccentColor(0x2ecc71)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# ✅ 출금 완료')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**📤 출금액**: ${amount.toLocaleString()} ${topyName}\n` +
        `**🏦 금고 잔액**: ${result.newTotal.toLocaleString()} ${topyName}\n` +
        `**💰 지갑 잔액**: ${walletBalance.toLocaleString()} ${topyName}`
      )
    );

  await interaction.editReply({
    components: [successContainer.toJSON()],
    flags: IS_COMPONENTS_V2,
  });
}

/** 은행 패널 모달 상호작용 핸들러 */
export async function handleBankPanelModalSubmit(
  interaction: ModalSubmitInteraction,
  container: Container
): Promise<boolean> {
  const customId = interaction.customId;

  if (!customId.startsWith('bank_panel_')) {
    return false;
  }

  switch (customId) {
    case 'bank_panel_deposit_modal':
      await handleDepositModalSubmit(interaction, container);
      return true;
    case 'bank_panel_withdraw_modal':
      await handleWithdrawModalSubmit(interaction, container);
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
