import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDTO } from './dto/create-product.dto.js';
import { AuditService } from '../common/audit/audit.service.js';
import { AuditAction } from '../generated/prisma/enums.js';
import { UpdateProductDTO } from './dto/update-product.dto.js';
import { StorageService } from '../storage/storage.service.js';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  // A new photo must be one we signed an upload for (null = remove the photo)
  private assertOwnImage(url: string | null | undefined) {
    if (url && !this.storage.keyFromUrl(url)) {
      throw new BadRequestException('Upload the image first');
    }
  }

  async createProduct(
    dto: CreateProductDTO,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    this.assertOwnImage(dto.image_url);

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        price_satang: dto.price_satang,
        is_active: dto.is_active,
        image_url: dto.image_url,
        category_id: dto.category_id,
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.CREATE_PRODUCT,
      entityType: 'Product',
      entityId: product.id,
      metadata: {
        createData: {
          name: dto.name,
          price_satang: dto.price_satang,
          is_active: dto.is_active,
          image_url: dto.image_url,
          category_id: dto.category_id,
        },
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return product;
  }

  async getProductList(includeInactive = false) {
    return await this.prisma.product.findMany({
      where: {
        ...(!includeInactive && { is_active: true }),
      },
    });
  }

  async getProduct(id: string) {
    return await this.prisma.product.findUniqueOrThrow({
      where: {
        id: id,
      },
    });
  }

  async updateProduct(
    dto: UpdateProductDTO,
    id: string,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: {
        id: id,
      },
    });

    const imageChanged =
      dto.image_url !== undefined && dto.image_url !== product.image_url;
    if (imageChanged) this.assertOwnImage(dto.image_url);

    const updatedProduct = await this.prisma.product.update({
      where: {
        id: product.id,
      },
      data: {
        name: dto.name,
        price_satang: dto.price_satang,
        image_url: dto.image_url,
        category_id: dto.category_id,
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.UPDATE_PRODUCT,
      entityType: 'Product',
      entityId: product.id,
      metadata: {
        updateData: {
          name: dto.name,
          price_satang: dto.price_satang,
          image_url: dto.image_url,
          category_id: dto.category_id,
        },
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    // replaced or removed: drop the old file if it was ours (best-effort)
    if (imageChanged) await this.storage.deleteByUrl(product.image_url);

    return updatedProduct;
  }

  async updateProductStatus(
    id: string,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const oldProduct = await this.prisma.product.findUniqueOrThrow({
      where: {
        id: id,
      },
    });

    const newProduct = await this.prisma.product.update({
      where: {
        id: oldProduct.id,
      },
      data: {
        is_active: !oldProduct.is_active,
      },
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: newProduct.is_active
        ? AuditAction.ACTIVE_PRODUCT
        : AuditAction.DEACTIVATE_PRODUCT,
      entityType: 'Product',
      entityId: newProduct.id,
      ipAddress: ip,
      userAgent: userAgent,
    });

    return newProduct;
  }
}
