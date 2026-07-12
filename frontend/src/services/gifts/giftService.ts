export type Gift = {
  id: string;
  name: string;
  coin: number;
};

export async function getCoinBalance() {
  return {
    coins: 2450,
  };
}

export async function sendGift(
  gift: Gift,
  receiverId: string
) {
  return {
    success: true,
    gift,
    receiverId,
    coinsLeft: 2450 - gift.coin,
  };
}
