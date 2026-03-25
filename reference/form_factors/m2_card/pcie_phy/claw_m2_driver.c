/*
 * claw_m2.ko — Linux kernel module for MLS M.2 inference card
 *
 * PCIe driver for mask-locked inference accelerator (M.2 2230, Key M)
 * Vendor ID: 0x1D3C (SuperInstance)
 * Device ID: 0x0020 (MLS M.2 Inference Card)
 *
 * Provides:
 *   /dev/claw0       — Character device for inference requests
 *   /sys/class/claw/ — Sysfs attributes (temperature, status, power)
 *
 * Copyright (c) 2026 Casey DiGennaro (SuperInstance.AI)
 * MIT License
 */

#include <linux/module.h>
#include <linux/pci.h>
#include <linux/cdev.h>
#include <linux/fs.h>
#include <linux/uaccess.h>

#define DRIVER_NAME    "claw_m2"
#define VENDOR_ID      0x1D3C
#define DEVICE_ID      0x0020

/* MLS Register offsets (MLS-Interface spec, BAR0) */
#define REG_CONTROL     0x000
#define REG_STATUS      0x004
#define REG_WEIGHT_BASE 0x008
#define REG_WEIGHT_SIZE 0x00C
#define REG_INPUT_BASE  0x010
#define REG_OUTPUT_BASE 0x014
#define REG_CHIP_ID     0x018
#define REG_TEMP        0x01C
#define REG_CASCADE_CTL 0x020
#define REG_PRIVACY_CTL 0x024

/* MLS Commands */
#define CMD_NOP              0x00
#define CMD_LOAD_WEIGHTS     0x01
#define CMD_RUN_INFERENCE    0x02
#define CMD_READ_LOGITS      0x03
#define CMD_CASCADE_ESCALATE 0x04
#define CMD_RESET            0xFF

/* Status bits */
#define STATUS_READY         (1 << 0)
#define STATUS_BUSY          (1 << 1)
#define STATUS_DONE          (1 << 2)
#define STATUS_ERROR         (1 << 3)
#define STATUS_THERMAL_WARN  (1 << 5)

struct claw_device {
    struct pci_dev  *pdev;
    void __iomem    *bar0;
    struct cdev      cdev;
    dev_t            devno;
    struct class    *cls;
};

/* Read/write MLS registers */
static inline u32 claw_read(struct claw_device *dev, u32 offset)
{
    return ioread32(dev->bar0 + offset);
}

static inline void claw_write(struct claw_device *dev, u32 offset, u32 val)
{
    iowrite32(val, dev->bar0 + offset);
}

/* Wait for chip ready */
static int claw_wait_ready(struct claw_device *dev, unsigned int timeout_ms)
{
    unsigned int elapsed = 0;
    u32 status;

    while (elapsed < timeout_ms) {
        status = claw_read(dev, REG_STATUS);
        if (status & STATUS_READY)
            return 0;
        usleep_range(100, 200);
        elapsed++;
    }

    return -ETIMEDOUT;
}

/* Run inference */
static int claw_run_inference(struct claw_device *dev)
{
    int ret;

    /* Check ready */
    if (!(claw_read(dev, REG_STATUS) & STATUS_READY))
        return -EBUSY;

    /* Check thermal */
    if (claw_read(dev, REG_STATUS) & STATUS_THERMAL_WARN) {
        dev_warn(&dev->pdev->dev, "Thermal throttling active\n");
        return -EAGAIN;
    }

    /* Issue RUN_INFERENCE command */
    claw_write(dev, REG_CONTROL, CMD_RUN_INFERENCE);

    /* Wait for completion */
    ret = claw_wait_ready(dev, 5000);  /* 5s timeout */
    if (ret) {
        dev_err(&dev->pdev->dev, "Inference timeout\n");
        claw_write(dev, REG_CONTROL, CMD_RESET);
    }

    return ret;
}

/* Character device operations */
static int claw_open(struct inode *inode, struct file *file)
{
    struct claw_device *dev = container_of(inode->i_cdev,
                                           struct claw_device, cdev);
    file->private_data = dev;
    return 0;
}

static ssize_t claw_write_file(struct file *file, const char __user *buf,
                               size_t count, loff_t *ppos)
{
    struct claw_device *dev = file->private_data;

    /* Write input data to chip DMA buffer, then run inference */
    /* (Simplified: real driver would use scatter-gather DMA) */

    return claw_run_inference(dev) ? -EIO : count;
}

static ssize_t claw_read_file(struct file *file, char __user *buf,
                              size_t count, loff_t *ppos)
{
    struct claw_device *dev = file->private_data;
    u32 status = claw_read(dev, REG_STATUS);

    /* Read output logits from chip */
    /* (Simplified: real driver would DMA results to userspace) */

    if (!(status & STATUS_DONE))
        return -EAGAIN;

    return 0;
}

static const struct file_operations claw_fops = {
    .owner = THIS_MODULE,
    .open  = claw_open,
    .write = claw_write_file,
    .read  = claw_read_file,
};

/* Sysfs: temperature */
static ssize_t temperature_show(struct device *dev,
                                struct device_attribute *attr, char *buf)
{
    struct claw_device *cdev = dev_get_drvdata(dev);
    u32 temp_raw = claw_read(cdev, REG_TEMP) & 0xFFF;
    /* Convert 12-bit raw to °C (approximate) */
    int temp_c = (temp_raw * 100) / 4096;
    return sprintf(buf, "%d\n", temp_c);
}
static DEVICE_ATTR_RO(temperature);

/* Sysfs: chip_id */
static ssize_t chip_id_show(struct device *dev,
                            struct device_attribute *attr, char *buf)
{
    struct claw_device *cdev = dev_get_drvdata(dev);
    u32 id = claw_read(cdev, REG_CHIP_ID);
    return sprintf(buf, "0x%02x\n", id & 0xFF);
}
static DEVICE_ATTR_RO(chip_id);

/* PCI probe */
static int claw_probe(struct pci_dev *pdev, const struct pci_device_id *ent)
{
    struct claw_device *dev;
    int ret;

    dev = devm_kzalloc(&pdev->dev, sizeof(*dev), GFP_KERNEL);
    if (!dev)
        return -ENOMEM;

    dev->pdev = pdev;
    pci_set_drvdata(pdev, dev);

    ret = pcim_enable_device(pdev);
    if (ret)
        return ret;

    ret = pcim_iomap_regions(pdev, 1 << 0, DRIVER_NAME);
    if (ret)
        return ret;

    dev->bar0 = pcim_iomap_table(pdev)[0];

    /* Verify chip ID */
    u32 chip_id = ioread32(dev->bar0 + REG_CHIP_ID);
    dev_info(&pdev->dev, "MLS M.2 card detected (chip_id=0x%02x)\n",
             chip_id & 0xFF);

    /* Create character device /dev/claw0 */
    ret = alloc_chrdev_region(&dev->devno, 0, 1, DRIVER_NAME);
    if (ret)
        return ret;

    cdev_init(&dev->cdev, &claw_fops);
    ret = cdev_add(&dev->cdev, dev->devno, 1);
    if (ret)
        goto err_chrdev;

    dev->cls = class_create(DRIVER_NAME);
    if (IS_ERR(dev->cls)) {
        ret = PTR_ERR(dev->cls);
        goto err_cdev;
    }

    device_create(dev->cls, &pdev->dev, dev->devno, dev, "claw0");

    /* Create sysfs attributes */
    device_create_file(&pdev->dev, &dev_attr_temperature);
    device_create_file(&pdev->dev, &dev_attr_chip_id);

    pci_set_master(pdev);
    dev_info(&pdev->dev, "MLS M.2 inference card ready\n");
    return 0;

err_cdev:
    cdev_del(&dev->cdev);
err_chrdev:
    unregister_chrdev_region(dev->devno, 1);
    return ret;
}

static void claw_remove(struct pci_dev *pdev)
{
    struct claw_device *dev = pci_get_drvdata(pdev);

    device_remove_file(&pdev->dev, &dev_attr_temperature);
    device_remove_file(&pdev->dev, &dev_attr_chip_id);
    device_destroy(dev->cls, dev->devno);
    class_destroy(dev->cls);
    cdev_del(&dev->cdev);
    unregister_chrdev_region(dev->devno, 1);

    dev_info(&pdev->dev, "MLS M.2 card removed\n");
}

static const struct pci_device_id claw_pci_ids[] = {
    { PCI_DEVICE(VENDOR_ID, DEVICE_ID) },
    { 0 }
};
MODULE_DEVICE_TABLE(pci, claw_pci_ids);

static struct pci_driver claw_driver = {
    .name     = DRIVER_NAME,
    .id_table = claw_pci_ids,
    .probe    = claw_probe,
    .remove   = claw_remove,
};

module_pci_driver(claw_driver);

MODULE_LICENSE("MIT");
MODULE_AUTHOR("Casey DiGennaro <casey@superinstance.ai>");
MODULE_DESCRIPTION("MLS M.2 Inference Card Driver");
MODULE_VERSION("0.1.0");
