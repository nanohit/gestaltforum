# CloudPayments

## Widget

Личный кабинет загружает официальный `cloudpayments.js` напрямую с `widget.cloudpayments.ru`. Карточные данные не попадают в Gestalt.forum.

В metadata передаются только:

- `userId`
- `planCode`

Сумма из браузера не считается доверенной. Webhook заново находит plan и сравнивает валюту и сумму в копейках.

## Webhook

Endpoint:

```text
POST https://ваш-домен/api/payments/cloudpayments-webhook?type=TYPE
```

В личном кабинете CloudPayments направьте на этот endpoint уведомления:

- `Check` → `?type=check`
- `Pay` → `?type=pay`
- `Fail` → `?type=fail`
- `Recurrent` → `?type=recurrent`
- `Cancel` → `?type=cancel`
- `Refund` → `?type=refund`

Формат CloudPayments, UTF-8, метод POST. Приложение может вывести тип по payload, но явный query parameter устраняет неоднозначность Cancel/Pay.

Подпись проверяется по `Content-HMAC` и `X-Content-HMAC`: HMAC-SHA256, API Secret, base64. Без `CLOUDPAYMENTS_WEBHOOK_SECRET` endpoint всегда отклоняет запрос.

## Идемпотентность и доступ

- каждый event получает уникальный `event_key`;
- `payments.cp_transaction_id` уникален;
- повторная доставка отвечает `{"code":0}` без повторного entitlement;
- успешный Pay/Confirm продлевает доступ от текущего будущего `ends_at` либо от текущего момента;
- Fail/Cancel/Refund обновляет статус, но не обрезает уже оплаченный `ends_at`;
- Recurrent синхронизирует статус подписки; само продление доступа происходит только по успешному платежу.

Для production проверьте test terminal, HMAC rejection, повторную доставку одного Pay и сценарий Cancel до окончания оплаченного периода.
